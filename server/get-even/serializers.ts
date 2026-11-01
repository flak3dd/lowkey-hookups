import type {
  Identity,
  InboxItem,
  Message,
  Profile,
  Receipt,
  ThreadSummary,
} from "../../shared/get-even";
import type {
  GetEvenMessageRow,
  GetEvenProbeRow,
  GetEvenReceiptRow,
  GetEvenThreadRow,
} from "../../drizzle/get-even-schema";
import { decryptPayload } from "./crypto";

export type ProfilePayload = {
  name: string;
  phone: string;
  photos: string[];
  hereTo?: string;
};
export type ReceiptPayload = { targetPhone: string; senderIdentity?: Identity };
export type MessagePayload = { text: string };

export function profileResponse(row: {
  id: string;
  intent: Profile["intent"];
  payloadCiphertext: string;
  createdAt: Date;
}): Profile {
  const payload = decryptPayload<ProfilePayload>(row.payloadCiphertext);
  return {
    id: row.id,
    name: payload.name,
    phone: payload.phone,
    intent: row.intent,
    photos: payload.photos,
    hereTo: payload.hereTo,
    numberVerified: true,
    createdAt: row.createdAt.toISOString(),
  };
}

export function receiptResponse(row: GetEvenReceiptRow): Receipt {
  const payload = decryptPayload<ReceiptPayload>(row.payloadCiphertext);
  return {
    id: row.id,
    targetPhone: payload.targetPhone,
    intent: row.intent,
    mode: row.mode,
    createdAt: row.createdAt.toISOString(),
    status: "Sent",
  };
}

export function inboxResponse(row: GetEvenProbeRow): InboxItem {
  const identity =
    row.mode === "named" && row.identityCiphertext
      ? decryptPayload<Identity>(row.identityCiphertext)
      : null;
  return {
    id: row.id,
    intent: row.intent,
    mode: row.mode,
    identity,
    createdAt: row.createdAt.toISOString(),
  };
}

export function threadResponse(
  thread: GetEvenThreadRow,
  viewerUserId: number,
  otherIdentity: Identity | null,
  lastMessage: string | null,
): ThreadSummary {
  const ownRevealed =
    thread.participantAUserId === viewerUserId
      ? Boolean(thread.participantAIdentityCiphertext)
      : Boolean(thread.participantBIdentityCiphertext);
  return {
    id: thread.id,
    intent: thread.intent,
    otherIdentity,
    ownRevealed,
    createdAt: thread.createdAt.toISOString(),
    lastMessage,
  };
}

export function messageResponse(row: GetEvenMessageRow, viewerUserId: number): Message {
  const payload = decryptPayload<MessagePayload>(row.payloadCiphertext);
  return {
    id: row.id,
    text: payload.text,
    isMine: row.senderUserId === viewerUserId,
    createdAt: row.createdAt.toISOString(),
  };
}
