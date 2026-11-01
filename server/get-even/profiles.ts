import { and, count, desc, eq, gte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getEvenBatches } from "../../drizzle/get-even-batches-schema";
import {
  getEvenMessages,
  getEvenProfiles,
  getEvenProbes,
  getEvenReceipts,
  getEvenReports,
  getEvenThreads,
} from "../../drizzle/get-even-schema";
import type {
  MassProbeResponse,
  Profile,
  Receipt,
  Viewer,
} from "../../shared/get-even";
import { getDb } from "../db";
import { encryptPayload, phoneHmac } from "./crypto";
import {
  profileResponse,
  receiptResponse,
  type ProfilePayload,
} from "./serializers";
import type { MassProbeInput, ProbeInput, ProfileInput } from "./validation";
import { lockParticipantProfiles } from "./safety-locks";
import { verifyPhoneToken } from "./phone-verification";

const SENDS_PER_24_HOURS = 20;
const PROFILE_CHANGE_MIN_INTERVAL_MS = 60_000;

type Actor = { id: number; name: string | null };

type MassRecipient = { phone: string; targetPhoneHmac: string };

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Get Even database unavailable");
  return db;
}

export async function getViewerWithProfile(
  actor: Actor,
): Promise<{ user: Viewer; profile: Profile | null }> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(getEvenProfiles)
    .where(eq(getEvenProfiles.ownerUserId, actor.id))
    .limit(1);
  return {
    user: { id: actor.id, name: actor.name },
    profile: rows[0] ? profileResponse(rows[0]) : null,
  };
}

export async function saveProfile(
  actor: Actor,
  input: ProfileInput,
): Promise<Profile> {
  const db = await requireDb();
  const now = new Date();
  const targetPhoneHmac = phoneHmac(input.phone);

  const existing = await db
    .select()
    .from(getEvenProfiles)
    .where(eq(getEvenProfiles.ownerUserId, actor.id))
    .limit(1);

  const isChangingPhone =
    !existing[0] || existing[0].phoneHmac !== targetPhoneHmac;
  if (isChangingPhone) {
    const verified = await verifyPhoneToken(
      input.phone,
      input.verificationToken,
    );
    if (!verified) {
      throw new Error("Phone verification required");
    }
  }

  const values = {
    phoneHmac: targetPhoneHmac,
    phoneBoundAt: now,
    intent: input.intent,
    payloadCiphertext: encryptPayload({
      name: input.name,
      phone: input.phone,
      photos: input.photos,
      hereTo: input.hereTo,
    }),
  };

  if (existing[0]) {
    if (
      now.getTime() - existing[0].updatedAt.getTime() <
      PROFILE_CHANGE_MIN_INTERVAL_MS
    ) {
      throw new Error("Profile change limit reached");
    }
    await db
      .update(getEvenProfiles)
      .set(values)
      .where(eq(getEvenProfiles.id, existing[0].id));
    const saved = await db
      .select()
      .from(getEvenProfiles)
      .where(eq(getEvenProfiles.id, existing[0].id))
      .limit(1);
    if (!saved[0]) throw new Error("Profile update unavailable");
    return profileResponse(saved[0]);
  }

  const id = randomUUID();
  await db.insert(getEvenProfiles).values({
    id,
    ownerUserId: actor.id,
    incarnationId: randomUUID(),
    createdAt: now,
    ...values,
  });
  const saved = await db
    .select()
    .from(getEvenProfiles)
    .where(eq(getEvenProfiles.id, id))
    .limit(1);
  if (!saved[0]) throw new Error("Profile creation unavailable");
  return profileResponse(saved[0]);
}

export async function listSent(actor: Actor): Promise<Receipt[]> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(getEvenReceipts)
    .where(eq(getEvenReceipts.senderUserId, actor.id))
    .orderBy(desc(getEvenReceipts.createdAt));
  return rows.map(receiptResponse);
}

export async function createSubmission(
  actor: Actor,
  input: ProbeInput,
): Promise<{ receiptId: string; status: "Sent" }> {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    // A stable sender mutex makes quota checking and insertion one atomic decision.
    // No recipient lookup or routing occurs in this acknowledgement transaction.
    await lockParticipantProfiles(tx, [actor.id]);
    const profileRows = await tx
      .select()
      .from(getEvenProfiles)
      .where(eq(getEvenProfiles.ownerUserId, actor.id))
      .limit(1);
    const profile = profileRows[0];
    if (!profile) throw new Error("Profile required");

    const duplicate = await tx
      .select({ id: getEvenReceipts.id })
      .from(getEvenReceipts)
      .where(
        and(
          eq(getEvenReceipts.senderUserId, actor.id),
          eq(getEvenReceipts.clientId, input.clientId),
        ),
      )
      .limit(1);
    if (duplicate[0])
      return { receiptId: duplicate[0].id, status: "Sent" as const };

    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const used = await tx
      .select({ value: count() })
      .from(getEvenReceipts)
      .where(
        and(
          eq(getEvenReceipts.senderUserId, actor.id),
          gte(getEvenReceipts.createdAt, windowStart),
        ),
      );
    if ((used[0]?.value ?? 0) >= SENDS_PER_24_HOURS)
      throw new Error("Submission limit reached");

    const sender = profileResponse(profile);
    const id = randomUUID();
    await tx
      .insert(getEvenReceipts)
      .values({
        id,
        senderUserId: actor.id,
        senderProfileId: profile.id,
        clientId: input.clientId,
        targetPhoneHmac: phoneHmac(input.phone),
        intent: input.intent,
        mode: input.mode,
        createdAt: new Date(),
        payloadCiphertext: encryptPayload({
          targetPhone: input.phone,
          ...(input.mode === "named"
            ? {
                senderIdentity: {
                  name: sender.name,
                  intent: sender.intent,
                  photos: sender.photos,
                  hereTo: sender.hereTo,
                },
              }
            : {}),
        }),
      })
      .onConflictDoNothing({
        target: [getEvenReceipts.senderUserId, getEvenReceipts.clientId],
      });
    const persisted = await tx
      .select({ id: getEvenReceipts.id })
      .from(getEvenReceipts)
      .where(
        and(
          eq(getEvenReceipts.senderUserId, actor.id),
          eq(getEvenReceipts.clientId, input.clientId),
        ),
      )
      .limit(1);
    if (!persisted[0]) throw new Error("Submission unavailable");
    return { receiptId: persisted[0].id, status: "Sent" as const };
  });
}

function prepareMassRecipients(input: MassProbeInput): {
  inputFingerprint: string;
  recipients: MassRecipient[];
} {
  const recipients = input.contacts.map(({ phone }) => ({
    phone,
    targetPhoneHmac: phoneHmac(phone),
  }));
  // This uses only existing keyed phone digests; neither contact labels nor
  // plaintext numbers participate in the durable idempotency fingerprint.
  const inputFingerprint = phoneHmac(
    JSON.stringify({
      v: 1,
      intent: input.intent,
      mode: input.mode,
      phones: recipients.map(({ targetPhoneHmac }) => targetPhoneHmac).sort(),
    }),
  );
  return { inputFingerprint, recipients };
}

/**
 * Persist an all-or-nothing opaque batch acknowledgement. Recipient resolution
 * remains exclusively deferred to the routing worker, after acknowledgement.
 */
export async function createMassSubmission(
  actor: Actor,
  input: MassProbeInput,
): Promise<MassProbeResponse> {
  const db = await requireDb();
  const { inputFingerprint, recipients } = prepareMassRecipients(input);
  return db.transaction(async (tx) => {
    // The same per-sender mutex as ordinary submissions serializes global quota.
    await lockParticipantProfiles(tx, [actor.id]);
    const profileRows = await tx
      .select()
      .from(getEvenProfiles)
      .where(eq(getEvenProfiles.ownerUserId, actor.id))
      .limit(1);
    const profile = profileRows[0];
    if (!profile) throw new Error("Profile required");

    const existingBatch = await tx
      .select({
        id: getEvenBatches.id,
        inputFingerprint: getEvenBatches.inputFingerprint,
        submittedCount: getEvenBatches.submittedCount,
      })
      .from(getEvenBatches)
      .where(
        and(
          eq(getEvenBatches.senderUserId, actor.id),
          eq(getEvenBatches.clientId, input.clientId),
        ),
      )
      .limit(1);
    if (existingBatch[0]) {
      if (existingBatch[0].inputFingerprint !== inputFingerprint)
        throw new Error("Submission unavailable");
      // Exact retries win before quota evaluation, including when quota is full.
      return {
        batchId: existingBatch[0].id,
        status: "Sent" as const,
        submittedCount: existingBatch[0].submittedCount,
      };
    }

    // The sender's current indexed number is the only profile data consulted in
    // this acknowledgement path. No recipient registration or safety lookup runs.
    const nonSelfRecipients = recipients.filter(
      (recipient) => recipient.targetPhoneHmac !== profile.phoneHmac,
    );
    if (!nonSelfRecipients.length) throw new Error("Submission unavailable");

    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const used = await tx
      .select({ value: count() })
      .from(getEvenReceipts)
      .where(
        and(
          eq(getEvenReceipts.senderUserId, actor.id),
          gte(getEvenReceipts.createdAt, windowStart),
        ),
      );
    if ((used[0]?.value ?? 0) + nonSelfRecipients.length > SENDS_PER_24_HOURS)
      throw new Error("Submission limit reached");

    const sender = profileResponse(profile);
    const now = new Date();
    const batchId = randomUUID();
    await tx.insert(getEvenReceipts).values(
      nonSelfRecipients.map((recipient, index) => ({
        id: randomUUID(),
        senderUserId: actor.id,
        senderProfileId: profile.id,
        // This id is opaque and derives only from the newly-created batch id.
        clientId: `batch:${batchId}:${index}`,
        targetPhoneHmac: recipient.targetPhoneHmac,
        intent: input.intent,
        mode: input.mode,
        createdAt: now,
        payloadCiphertext: encryptPayload({
          targetPhone: recipient.phone,
          ...(input.mode === "named"
            ? {
                senderIdentity: {
                  name: sender.name,
                  intent: sender.intent,
                  photos: sender.photos,
                  hereTo: sender.hereTo,
                },
              }
            : {}),
        }),
      })),
    );
    // Insert last so a batch acknowledgement cannot exist without every receipt.
    await tx.insert(getEvenBatches).values({
      id: batchId,
      senderUserId: actor.id,
      clientId: input.clientId,
      inputFingerprint,
      submittedCount: nonSelfRecipients.length,
      createdAt: now,
    });
    return {
      batchId,
      status: "Sent" as const,
      submittedCount: nonSelfRecipients.length,
    };
  });
}

/** Delete Get Even data only. Manus users and durable minimum block relationships remain. */
export async function deleteGetEvenProfile(actor: Actor): Promise<void> {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    const profileRows = await tx
      .select()
      .from(getEvenProfiles)
      .where(eq(getEvenProfiles.ownerUserId, actor.id))
      .limit(1);
    if (!profileRows[0]) return;

    const ownedThreads = await tx
      .select({ id: getEvenThreads.id })
      .from(getEvenThreads)
      .where(eq(getEvenThreads.participantAUserId, actor.id));
    const receivedThreads = await tx
      .select({ id: getEvenThreads.id })
      .from(getEvenThreads)
      .where(eq(getEvenThreads.participantBUserId, actor.id));
    const threadIds = [...ownedThreads, ...receivedThreads].map(
      (thread) => thread.id,
    );
    for (const threadId of threadIds) {
      await tx
        .delete(getEvenMessages)
        .where(eq(getEvenMessages.threadId, threadId));
      await tx.delete(getEvenThreads).where(eq(getEvenThreads.id, threadId));
    }

    await tx
      .delete(getEvenProbes)
      .where(eq(getEvenProbes.recipientUserId, actor.id));
    await tx
      .delete(getEvenProbes)
      .where(eq(getEvenProbes.senderUserId, actor.id));
    await tx
      .delete(getEvenReceipts)
      .where(eq(getEvenReceipts.senderUserId, actor.id));
    await tx
      .delete(getEvenBatches)
      .where(eq(getEvenBatches.senderUserId, actor.id));
    await tx
      .delete(getEvenReports)
      .where(eq(getEvenReports.reporterUserId, actor.id));
    // Blocks intentionally survive to resist delete/recreate evasion by either account.
    await tx
      .delete(getEvenProfiles)
      .where(eq(getEvenProfiles.id, profileRows[0].id));
  });
}

export async function requireCurrentProfile(actor: Actor) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(getEvenProfiles)
    .where(eq(getEvenProfiles.ownerUserId, actor.id))
    .limit(1);
  if (!rows[0]) throw new Error("Profile required");
  return rows[0];
}
