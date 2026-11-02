import { and, asc, desc, eq, gt, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getEvenBlocks,
  getEvenCandidates,
  getEvenMessages,
  getEvenProfiles,
  getEvenProbes,
  getEvenReports,
  getEvenThreads,
  type GetEvenMessageRow,
  type GetEvenCandidateRow,
  type GetEvenProbeRow,
  type GetEvenThreadRow,
} from "../../drizzle/get-even-schema";
import type { BlockItem, CandidateResponse, CandidateSummary, Identity, InboxItem, ThreadResponse, ThreadSummary } from "../../shared/get-even";
import { getDb } from "../db";
import { decryptPayload, encryptPayload, phoneHmac } from "./crypto";
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

export async function ensureMutualCandidate(tx: any, probe: Pick<GetEvenProbeRow, "id" | "senderUserId" | "recipientUserId">): Promise<string | null> {
  const reciprocal = await tx
    .select()
    .from(getEvenProbes)
    .where(
      and(
        eq(getEvenProbes.senderUserId, probe.recipientUserId),
        eq(getEvenProbes.recipientUserId, probe.senderUserId),
        eq(getEvenProbes.state, "open"),
        gt(getEvenProbes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(getEvenProbes.createdAt))
    .limit(1);
  const other = reciprocal[0];
  if (!other || (await hasBlock(tx, probe.senderUserId, probe.recipientUserId))) return null;
  const [probeAId, probeBId] = [probe.id, other.id].sort();
  const existing = await tx
    .select({ id: getEvenCandidates.id })
    .from(getEvenCandidates)
    .where(and(eq(getEvenCandidates.probeAId, probeAId), eq(getEvenCandidates.probeBId, probeBId)))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [participantAUserId, participantBUserId] = [probe.senderUserId, probe.recipientUserId].sort((a, b) => a - b);
  const id = randomUUID();
  await tx.insert(getEvenCandidates).values({
    id,
    probeAId,
    probeBId,
    participantAUserId,
    participantBUserId,
  });
  return id;
}

export async function acceptProbe(actor: Actor, probeId: string): Promise<string | null> {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    let probe = await currentRecipientProbe(tx, actor, probeId, true);
    if (!probe || probe.state !== "open" || isExpired(probe.expiresAt, new Date())) return null;
    await lockParticipantProfiles(tx, [actor.id, probe.senderUserId]);
    probe = await currentRecipientProbe(tx, actor, probeId, true);
    if (!probe || (await hasBlock(tx, actor.id, probe.senderUserId)) || (await hasBlock(tx, probe.senderUserId, actor.id))) return null;
    const recipientProfileRows = await tx.select().from(getEvenProfiles).where(eq(getEvenProfiles.ownerUserId, actor.id)).limit(1);
    const senderProfileRows = await tx.select().from(getEvenProfiles).where(eq(getEvenProfiles.ownerUserId, probe.senderUserId)).limit(1);
    const recipient = recipientProfileRows[0];
    const sender = senderProfileRows[0];
    if (!recipient || !sender) return null;
    const existing = await tx.select().from(getEvenProbes).where(and(
      eq(getEvenProbes.senderUserId, actor.id),
      eq(getEvenProbes.recipientUserId, probe.senderUserId),
      eq(getEvenProbes.state, "open"),
      gt(getEvenProbes.expiresAt, new Date()),
    )).limit(1);
    const reciprocal = existing[0] ?? {
      id: randomUUID(),
      receiptId: randomUUID(),
      recipientUserId: probe.senderUserId,
      recipientProfileId: sender.id,
      recipientIncarnationId: sender.incarnationId,
      senderUserId: actor.id,
      senderProfileId: recipient.id,
      intent: probe.intent,
      mode: "anonymous" as const,
      identityCiphertext: null,
      state: "open" as const,
      threadId: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
    };
    if (!existing[0]) await tx.insert(getEvenProbes).values(reciprocal);
    return ensureMutualCandidate(tx, probe);
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

function candidateResponse(row: GetEvenCandidateRow, actorId: number): CandidateResponse {
  const isA = row.participantAUserId === actorId;
  const guesses = isA ? row.participantAGuessCount : row.participantBGuessCount;
  const activeLock = row.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil : null;
  return {
    candidate: {
      id: row.id,
      guessesRemaining: Math.max(0, 2 - guesses),
      otherGuessedCorrectly: isA ? row.participantBCorrect : row.participantACorrect,
      lockedUntil: activeLock?.toISOString() ?? null,
      threadId: row.threadId,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

async function accessibleCandidate(db: any, actor: Actor, candidateId: string) {
  const rows = await db.select().from(getEvenCandidates).where(eq(getEvenCandidates.id, candidateId)).limit(1);
  const candidate = rows[0];
  if (!candidate || (candidate.participantAUserId !== actor.id && candidate.participantBUserId !== actor.id)) return null;
  const otherUserId = candidate.participantAUserId === actor.id ? candidate.participantBUserId : candidate.participantAUserId;
  if (await hasBlock(db, actor.id, otherUserId)) return null;
  return candidate;
}

export async function listCandidates(actor: Actor): Promise<CandidateSummary[]> {
  const db = await requireDb();
  const rows = await db.select().from(getEvenCandidates).where(
    or(eq(getEvenCandidates.participantAUserId, actor.id), eq(getEvenCandidates.participantBUserId, actor.id)),
  ).orderBy(desc(getEvenCandidates.updatedAt));
  return rows.map((row) => candidateResponse(row, actor.id).candidate);
}

export async function getCandidate(actor: Actor, candidateId: string): Promise<CandidateResponse | null> {
  const db = await requireDb();
  const row = await accessibleCandidate(db, actor, candidateId);
  return row ? candidateResponse(row, actor.id) : null;
}

export async function guessCandidate(actor: Actor, candidateId: string, guessedPhone: string): Promise<CandidateResponse | null> {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    let candidate = await accessibleCandidate(tx, actor, candidateId);
    if (!candidate) return null;
    const now = new Date();
    if (candidate.lockedUntil && candidate.lockedUntil > now) return candidateResponse(candidate, actor.id);
    if (candidate.lockedUntil && candidate.lockedUntil <= now) {
      await tx.update(getEvenCandidates).set({
        participantAGuessCount: 0,
        participantBGuessCount: 0,
        participantACorrect: false,
        participantBCorrect: false,
        lockedUntil: null,
      }).where(eq(getEvenCandidates.id, candidate.id));
      candidate = await accessibleCandidate(tx, actor, candidateId);
      if (!candidate) return null;
    }
    const isA = candidate.participantAUserId === actor.id;
    const alreadyCorrect = isA ? candidate.participantACorrect : candidate.participantBCorrect;
    if (alreadyCorrect) return candidateResponse(candidate, actor.id);
    const otherUserId = isA ? candidate.participantBUserId : candidate.participantAUserId;
    const otherProfileRows = await tx.select().from(getEvenProfiles).where(eq(getEvenProfiles.ownerUserId, otherUserId)).limit(1);
    const otherProfile = otherProfileRows[0];
    if (!otherProfile) return null;
    const correct = phoneHmac(guessedPhone) === otherProfile.phoneHmac;
    const countField = isA ? "participantAGuessCount" : "participantBGuessCount";
    const correctField = isA ? "participantACorrect" : "participantBCorrect";
    const nextCount = (isA ? candidate.participantAGuessCount : candidate.participantBGuessCount) + 1;
    await tx.update(getEvenCandidates).set({
      [countField]: nextCount,
      [correctField]: correct,
      lockedUntil: !correct && nextCount >= 2 ? new Date(now.getTime() + 24 * 60 * 60 * 1_000) : candidate.lockedUntil,
      updatedAt: now,
    }).where(eq(getEvenCandidates.id, candidate.id));
    candidate = await accessibleCandidate(tx, actor, candidateId);
    if (!candidate) return null;
    if (correct && candidate.participantACorrect && candidate.participantBCorrect && !candidate.threadId) {
      const profiles = await tx.select().from(getEvenProfiles).where(or(
        eq(getEvenProfiles.ownerUserId, candidate.participantAUserId),
        eq(getEvenProfiles.ownerUserId, candidate.participantBUserId),
      ));
      const profileA = profiles.find((profile: any) => profile.ownerUserId === candidate.participantAUserId);
      const profileB = profiles.find((profile: any) => profile.ownerUserId === candidate.participantBUserId);
      if (!profileA || !profileB) return candidateResponse(candidate, actor.id);
      const threadId = randomUUID();
      await tx.insert(getEvenThreads).values({
        id: threadId,
        intent: profileA.intent,
        participantAUserId: candidate.participantAUserId,
        participantBUserId: candidate.participantBUserId,
        participantAIdentityCiphertext: encryptPayload(profileResponse(profileA)),
        participantBIdentityCiphertext: encryptPayload(profileResponse(profileB)),
      });
      await tx.update(getEvenCandidates).set({ threadId, updatedAt: now }).where(eq(getEvenCandidates.id, candidate.id));
      await tx.update(getEvenProbes).set({ state: "accepted", threadId }).where(or(
        eq(getEvenProbes.id, candidate.probeAId),
        eq(getEvenProbes.id, candidate.probeBId),
      ));
      candidate = await accessibleCandidate(tx, actor, candidateId);
    }
    return candidate ? candidateResponse(candidate, actor.id) : null;
  });
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
