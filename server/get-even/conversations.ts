import { and, asc, desc, eq, gt, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getEvenBlocks,
  getEvenMessages,
  getEvenProfiles,
  getEvenProbes,
  getEvenReports,
  getEvenThreads,
  type GetEvenMessageRow,
  type GetEvenThreadRow,
} from "../../drizzle/get-even-schema";
import type { BlockItem, Identity, InboxItem, ThreadResponse, ThreadSummary } from "../../shared/get-even";
import { getDb } from "../db";
import { decryptPayload, encryptPayload } from "./crypto";
import { canAccessThread, isExpired, isVisibleToUser, otherParticipant } from "./policy";
import { requireCurrentProfile } from "./profiles";
import { lockParticipantProfiles } from "./safety-locks";
import { inboxResponse, messageResponse, profileResponse, threadResponse } from "./serializers";

const Actor = {} as { id: number; name: string | null };
type Actor = typeof Actor;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Get Even database unavailable");
  return db;
}

async function hasBlock(db: any, ownerUserId: number, blockedUserId: number): Promise<boolean> {
  const rows = await db
    .select({ id: getEvenBlocks.id })
    .from(getEvenBlocks)
    .where(
      and(eq(getEvenBlocks.ownerUserId, ownerUserId), eq(getEvenBlocks.blockedUserId, blockedUserId)),
    )
    .limit(1);
  return Boolean(rows[0]);
}

async function addBlock(db: any, ownerUserId: number, blockedUserId: number): Promise<void> {
  if (ownerUserId === blockedUserId) return;
  await db
    .insert(getEvenBlocks)
    .values({ id: randomUUID(), ownerUserId, blockedUserId })
    .onConflictDoNothing({ target: [getEvenBlocks.ownerUserId, getEvenBlocks.blockedUserId] });
}

async function currentRecipientProbe(db: any, actor: Actor, probeId: string, allowExpired = false) {
  const profileRows = await db
    .select()
    .from(getEvenProfiles)
    .where(eq(getEvenProfiles.ownerUserId, actor.id))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return null;
  const conditions = [
    eq(getEvenProbes.id, probeId),
    eq(getEvenProbes.recipientUserId, actor.id),
    eq(getEvenProbes.recipientProfileId, profile.id),
    eq(getEvenProbes.recipientIncarnationId, profile.incarnationId),
  ];
  if (!allowExpired) conditions.push(gt(getEvenProbes.expiresAt, new Date()));
  const rows = await db.select().from(getEvenProbes).where(and(...conditions)).limit(1);
  return rows[0] ?? null;
}

async function accessibleThread(db: any, actor: Actor, threadId: string): Promise<GetEvenThreadRow | null> {
  const rows = await db.select().from(getEvenThreads).where(eq(getEvenThreads.id, threadId)).limit(1);
  const thread = rows[0];
  if (!thread || !canAccessThread(thread, actor.id)) return null;
  const otherUserId = otherParticipant(thread, actor.id);
  if (otherUserId === null || (await hasBlock(db, actor.id, otherUserId))) return null;
  return thread;
}

async function lastVisibleMessage(db: any, threadId: string, viewerUserId: number): Promise<string | null> {
  const rows = await db
    .select()
    .from(getEvenMessages)
    .where(eq(getEvenMessages.threadId, threadId))
    .orderBy(desc(getEvenMessages.createdAt));
  const row = rows.find((message: GetEvenMessageRow) => isVisibleToUser(message, viewerUserId));
  return row ? messageResponse(row, viewerUserId).text : null;
}

function otherIdentity(thread: GetEvenThreadRow, actorId: number): Identity | null {
  const ciphertext =
    thread.participantAUserId === actorId
      ? thread.participantBIdentityCiphertext
      : thread.participantAIdentityCiphertext;
  return ciphertext ? decryptPayload<Identity>(ciphertext) : null;
}

export async function listInbox(actor: Actor): Promise<InboxItem[]> {
  const db = await requireDb();
  const profile = await requireCurrentProfile(actor);
  const rows = await db
    .select()
    .from(getEvenProbes)
    .where(
      and(
        eq(getEvenProbes.recipientUserId, actor.id),
        eq(getEvenProbes.recipientProfileId, profile.id),
        eq(getEvenProbes.recipientIncarnationId, profile.incarnationId),
        eq(getEvenProbes.state, "open"),
        gt(getEvenProbes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(getEvenProbes.createdAt));
  const blocks = await db
    .select({ blockedUserId: getEvenBlocks.blockedUserId })
    .from(getEvenBlocks)
    .where(eq(getEvenBlocks.ownerUserId, actor.id));
  const blocked = new Set(blocks.map((block) => block.blockedUserId));
  return rows.filter((probe) => !blocked.has(probe.senderUserId)).map(inboxResponse);
}

export async function ignoreProbe(actor: Actor, probeId: string): Promise<boolean> {
  const db = await requireDb();
  const probe = await currentRecipientProbe(db, actor, probeId);
  if (!probe || probe.state !== "open") return false;
  await db
    .update(getEvenProbes)
    .set({ state: "ignored" })
    .where(and(eq(getEvenProbes.id, probe.id), eq(getEvenProbes.state, "open")));
  return true;
}

export async function acceptProbe(actor: Actor, probeId: string, text: string): Promise<string | null> {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    let probe = await currentRecipientProbe(tx, actor, probeId, true);
    if (!probe) return null;
    await lockParticipantProfiles(tx, [actor.id, probe.senderUserId]);
    probe = await currentRecipientProbe(tx, actor, probeId, true);
    if (!probe) return null;
    if (probe.state === "accepted" && probe.threadId) return probe.threadId;
    if (probe.state !== "open" || isExpired(probe.expiresAt, new Date())) return null;
    if ((await hasBlock(tx, actor.id, probe.senderUserId)) || (await hasBlock(tx, probe.senderUserId, actor.id))) {
      return null;
    }

    const threadId = randomUUID();
    const messageId = randomUUID();
    const transitioned = await tx
      .update(getEvenProbes)
      .set({ state: "accepted", threadId })
      .where(and(eq(getEvenProbes.id, probe.id), eq(getEvenProbes.state, "open")))
      .returning({ id: getEvenProbes.id });
    if (transitioned.length !== 1) {
      const retry = await currentRecipientProbe(tx, actor, probeId, true);
      return retry?.state === "accepted" ? retry.threadId ?? null : null;
    }

    await tx.insert(getEvenThreads).values({
      id: threadId,
      intent: probe.intent,
      participantAUserId: probe.senderUserId,
      participantBUserId: actor.id,
    });
    await tx.insert(getEvenMessages).values({
      id: messageId,
      threadId,
      senderUserId: actor.id,
      clientId: `accept:${probe.id}`,
      payloadCiphertext: encryptPayload({ text }),
    });
    return threadId;
  });
}

export async function blockProbe(actor: Actor, probeId: string): Promise<boolean> {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    let probe = await currentRecipientProbe(tx, actor, probeId, true);
    if (!probe) return false;
    await lockParticipantProfiles(tx, [actor.id, probe.senderUserId]);
    probe = await currentRecipientProbe(tx, actor, probeId, true);
    if (!probe) return false;
    await addBlock(tx, actor.id, probe.senderUserId);
    await tx.update(getEvenProbes).set({ state: "blocked" }).where(eq(getEvenProbes.id, probe.id));
    return true;
  });
}

export async function reportProbe(
  actor: Actor,
  probeId: string,
  reason: string,
  includeContent: boolean,
): Promise<boolean> {
  const db = await requireDb();
  const probe = await currentRecipientProbe(db, actor, probeId, true);
  if (!probe) return false;
  const evidence =
    includeContent && probe.identityCiphertext
      ? { identity: decryptPayload<Identity>(probe.identityCiphertext) }
      : null;
  await db.insert(getEvenReports).values({
    id: randomUUID(),
    reporterUserId: actor.id,
    subjectType: "probe",
    subjectId: probe.id,
    reason,
    includeContent,
    evidenceCiphertext: evidence ? encryptPayload(evidence) : null,
  });
  return true;
}

export async function listThreads(actor: Actor): Promise<ThreadSummary[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(getEvenThreads)
    .where(or(eq(getEvenThreads.participantAUserId, actor.id), eq(getEvenThreads.participantBUserId, actor.id)))
    .orderBy(desc(getEvenThreads.updatedAt));
  const blocks = await db
    .select({ blockedUserId: getEvenBlocks.blockedUserId })
    .from(getEvenBlocks)
    .where(eq(getEvenBlocks.ownerUserId, actor.id));
  const blocked = new Set(blocks.map((block) => block.blockedUserId));

  const summaries: ThreadSummary[] = [];
  for (const thread of rows) {
    const otherUserId = otherParticipant(thread, actor.id);
    if (otherUserId === null || blocked.has(otherUserId)) continue;
    summaries.push(
      threadResponse(thread, actor.id, otherIdentity(thread, actor.id), await lastVisibleMessage(db, thread.id, actor.id)),
    );
  }
  return summaries;
}

export async function getThread(actor: Actor, threadId: string): Promise<ThreadResponse | null> {
  const db = await requireDb();
  const thread = await accessibleThread(db, actor, threadId);
  if (!thread) return null;
  const rows = await db
    .select()
    .from(getEvenMessages)
    .where(eq(getEvenMessages.threadId, thread.id))
    .orderBy(asc(getEvenMessages.createdAt));
  const messages = rows.filter((message) => isVisibleToUser(message, actor.id)).map((message) => messageResponse(message, actor.id));
  return {
    thread: threadResponse(thread, actor.id, otherIdentity(thread, actor.id), await lastVisibleMessage(db, thread.id, actor.id)),
    messages,
  };
}

export async function postThreadMessage(
  actor: Actor,
  threadId: string,
  text: string,
  clientId: string,
): Promise<boolean> {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    let thread = await accessibleThread(tx, actor, threadId);
    if (!thread) return false;
    const initialRecipientUserId = otherParticipant(thread, actor.id);
    if (initialRecipientUserId === null) return false;
    await lockParticipantProfiles(tx, [actor.id, initialRecipientUserId]);
    thread = await accessibleThread(tx, actor, threadId);
    if (!thread) return false;
    const existing = await tx
      .select({ id: getEvenMessages.id })
      .from(getEvenMessages)
      .where(
        and(
          eq(getEvenMessages.threadId, thread.id),
          eq(getEvenMessages.senderUserId, actor.id),
          eq(getEvenMessages.clientId, clientId),
        ),
      )
      .limit(1);
    if (existing[0]) return true;

    const recipientUserId = otherParticipant(thread, actor.id);
    if (recipientUserId === null) return false;
    const suppress = await hasBlock(tx, recipientUserId, actor.id);
    await tx
      .insert(getEvenMessages)
      .values({
        id: randomUUID(),
        threadId: thread.id,
        senderUserId: actor.id,
        clientId,
        payloadCiphertext: encryptPayload({ text }),
        suppressedForUserId: suppress ? recipientUserId : null,
      })
      .onConflictDoNothing({
        target: [getEvenMessages.threadId, getEvenMessages.senderUserId, getEvenMessages.clientId],
      });
    await tx.update(getEvenThreads).set({ updatedAt: new Date() }).where(eq(getEvenThreads.id, thread.id));
    return true;
  });
}

export async function revealThreadIdentity(actor: Actor, threadId: string): Promise<boolean> {
  const db = await requireDb();
  const thread = await accessibleThread(db, actor, threadId);
  if (!thread) return false;
  const profile = await requireCurrentProfile(actor);
  const identity = profileResponse(profile);
  const ciphertext = encryptPayload({ name: identity.name, intent: identity.intent, photos: identity.photos });
  if (thread.participantAUserId === actor.id) {
    await db
      .update(getEvenThreads)
      .set({ participantAIdentityCiphertext: ciphertext })
      .where(eq(getEvenThreads.id, thread.id));
  } else {
    await db
      .update(getEvenThreads)
      .set({ participantBIdentityCiphertext: ciphertext })
      .where(eq(getEvenThreads.id, thread.id));
  }
  return true;
}

export async function blockThread(actor: Actor, threadId: string): Promise<boolean> {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    let thread = await accessibleThread(tx, actor, threadId);
    if (!thread) return false;
    const otherUserId = otherParticipant(thread, actor.id);
    if (otherUserId === null) return false;
    await lockParticipantProfiles(tx, [actor.id, otherUserId]);
    thread = await accessibleThread(tx, actor, threadId);
    if (!thread) return false;
    await addBlock(tx, actor.id, otherUserId);
    return true;
  });
}

export async function reportThread(
  actor: Actor,
  threadId: string,
  reason: string,
  includeContent: boolean,
): Promise<boolean> {
  const db = await requireDb();
  const thread = await accessibleThread(db, actor, threadId);
  if (!thread) return false;
  let evidenceCiphertext: string | null = null;
  if (includeContent) {
    const rows = await db
      .select()
      .from(getEvenMessages)
      .where(eq(getEvenMessages.threadId, thread.id))
      .orderBy(asc(getEvenMessages.createdAt));
    const messages = rows
      .filter((message) => isVisibleToUser(message, actor.id))
      .map((message) => ({ text: messageResponse(message, actor.id).text, createdAt: message.createdAt.toISOString() }));
    evidenceCiphertext = encryptPayload({ messages });
  }
  await db.insert(getEvenReports).values({
    id: randomUUID(),
    reporterUserId: actor.id,
    subjectType: "thread",
    subjectId: thread.id,
    reason,
    includeContent,
    evidenceCiphertext,
  });
  return true;
}

export async function listBlocks(actor: Actor): Promise<BlockItem[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(getEvenBlocks)
    .where(eq(getEvenBlocks.ownerUserId, actor.id))
    .orderBy(desc(getEvenBlocks.createdAt));
  // Never use counterpart profile data in this surface: an anonymous block must remain anonymous.
  return rows.map((row) => ({ id: row.id, label: "Blocked contact", createdAt: row.createdAt.toISOString() }));
}

export async function removeBlock(actor: Actor, blockId: string): Promise<boolean> {
  const db = await requireDb();
  const removed = await db
    .delete(getEvenBlocks)
    .where(and(eq(getEvenBlocks.id, blockId), eq(getEvenBlocks.ownerUserId, actor.id)))
    .returning({ id: getEvenBlocks.id });
  return removed.length > 0;
}

export async function wipeInbox(actor: Actor): Promise<void> {
  const db = await requireDb();
  const profile = await requireCurrentProfile(actor);
  // This only removes recipient-owned first-contact copies; sender receipt acknowledgements remain untouched.
  await db
    .delete(getEvenProbes)
    .where(
      and(
        eq(getEvenProbes.recipientUserId, actor.id),
        eq(getEvenProbes.recipientProfileId, profile.id),
        eq(getEvenProbes.recipientIncarnationId, profile.incarnationId),
      ),
    );
}
