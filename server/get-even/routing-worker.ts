import { and, asc, eq, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getEvenBlocks,
  getEvenProfiles,
  getEvenProbes,
  getEvenReceipts,
} from "../../drizzle/get-even-schema";
import { getDb } from "../db";
import { decryptPayload, encryptPayload } from "./crypto";
import { selectSingleEligibleRecipient } from "./policy";
import { lockParticipantProfiles } from "./safety-locks";
import { ensureMutualCandidate } from "./conversations";
import type { ReceiptPayload } from "./serializers";

const PROBE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;
const BATCH_SIZE = 20;
let workerStarted = false;
let workerTimer: ReturnType<typeof setInterval> | undefined;

async function markProcessed(tx: any, id: string) {
  await tx
    .update(getEvenReceipts)
    .set({ routingStatus: "processed", routedAt: new Date() })
    .where(eq(getEvenReceipts.id, id));
}

async function isEitherDirectionBlocked(tx: any, firstUserId: number, secondUserId: number) {
  const rows = await tx
    .select({ id: getEvenBlocks.id })
    .from(getEvenBlocks)
    .where(
      or(
        and(eq(getEvenBlocks.ownerUserId, firstUserId), eq(getEvenBlocks.blockedUserId, secondUserId)),
        and(eq(getEvenBlocks.ownerUserId, secondUserId), eq(getEvenBlocks.blockedUserId, firstUserId)),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

/** Route one persisted work item. Every non-deliverable outcome is simply processed and discarded. */
export async function routeReceipt(receiptId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.transaction(async (tx) => {
    const claim = await tx
      .update(getEvenReceipts)
      .set({ routingStatus: "processing" })
      .where(and(eq(getEvenReceipts.id, receiptId), eq(getEvenReceipts.routingStatus, "pending")))
      .returning({ id: getEvenReceipts.id });
    if (claim.length !== 1) return;

    const receiptRows = await tx
      .select()
      .from(getEvenReceipts)
      .where(eq(getEvenReceipts.id, receiptId))
      .limit(1);
    const receipt = receiptRows[0];
    if (!receipt) return;

    const candidates = await tx
      .select()
      .from(getEvenProfiles)
      .where(
        and(
          eq(getEvenProfiles.phoneHmac, receipt.targetPhoneHmac),
          lte(getEvenProfiles.createdAt, receipt.createdAt),
          lte(getEvenProfiles.phoneBoundAt, receipt.createdAt),
        ),
      );
    const recipient = selectSingleEligibleRecipient(candidates, receipt.senderUserId, receipt.createdAt);
    if (!recipient) {
      await markProcessed(tx, receipt.id);
      return;
    }

    // Serialize against either participant's block action before binding the current incarnation.
    await lockParticipantProfiles(tx, [receipt.senderUserId, recipient.ownerUserId]);
    // Re-read the current profile in the same transaction before binding its incarnation.
    const currentRows = await tx
      .select()
      .from(getEvenProfiles)
      .where(eq(getEvenProfiles.id, (recipient as typeof candidates[number]).id))
      .limit(1);
    const current = currentRows[0];
    if (
      !current ||
      current.createdAt > receipt.createdAt ||
      current.phoneBoundAt > receipt.createdAt
    ) {
      await markProcessed(tx, receipt.id);
      return;
    }
    if (await isEitherDirectionBlocked(tx, receipt.senderUserId, current.ownerUserId)) {
      await markProcessed(tx, receipt.id);
      return;
    }

    const payload = decryptPayload<ReceiptPayload>(receipt.payloadCiphertext);
    const now = new Date();
    const inserted = {
      id: randomUUID(),
      receiptId: receipt.id,
      recipientUserId: current.ownerUserId,
      recipientProfileId: current.id,
      recipientIncarnationId: current.incarnationId,
      senderUserId: receipt.senderUserId,
      senderProfileId: receipt.senderProfileId,
      intent: receipt.intent,
      mode: receipt.mode,
      // Anonymous records deliberately contain no encrypted identity to accidentally expose later.
      identityCiphertext:
        receipt.mode === "named" && payload.senderIdentity ? encryptPayload(payload.senderIdentity) : null,
      expiresAt: new Date(now.getTime() + PROBE_LIFETIME_MS),
    };
    await tx.insert(getEvenProbes).values(inserted);
    await ensureMutualCandidate(tx, inserted);
    await markProcessed(tx, receipt.id);
  });
}

export async function processGetEvenRoutingQueue(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const pending = await db
    .select({ id: getEvenReceipts.id })
    .from(getEvenReceipts)
    .where(eq(getEvenReceipts.routingStatus, "pending"))
    .orderBy(asc(getEvenReceipts.createdAt))
    .limit(BATCH_SIZE);
  for (const receipt of pending) {
    try {
      await routeReceipt(receipt.id);
    } catch {
      // A future finite interval retries transactional failures; never expose routing diagnostics.
    }
  }
}

/** One process-local finite worker; it performs bounded batches and never sends external messages. */
export function startGetEvenRoutingWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  void processGetEvenRoutingQueue();
  workerTimer = setInterval(() => void processGetEvenRoutingQueue(), 60_000);
  workerTimer.unref?.();
}

/** Test-only shutdown hook; production does not invoke it. */
export function stopGetEvenRoutingWorkerForTests(): void {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = undefined;
  workerStarted = false;
}
