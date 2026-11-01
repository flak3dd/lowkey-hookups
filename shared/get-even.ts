export const INTENTS = ["Kiss"] as const;
export type Intent = (typeof INTENTS)[number];
/** Display symbol for each intent. The stored value stays a plain word. */
export const INTENT_SYMBOL: Record<Intent, string> = { Kiss: "💋" };
export const intentLabel = (intent: Intent) =>
  `${INTENT_SYMBOL[intent] ?? ""} ${intent}`.trim();
export type IdentityMode = "anonymous" | "named";
export type Identity = {
  name: string;
  intent: Intent;
  photos: string[];
  hereTo?: string;
};
export type Profile = Identity & {
  id: string;
  phone: string;
  hereTo?: string;
  numberVerified: boolean;
  createdAt: string;
};
export type Viewer = { id: number; name: string | null };
export type MeResponse = { user: Viewer; profile: Profile | null };
export type Receipt = {
  id: string;
  targetPhone: string;
  intent: Intent;
  mode: IdentityMode;
  createdAt: string;
  status: "Sent";
};
export type InboxItem = {
  id: string;
  intent: Intent;
  mode: IdentityMode;
  identity: Identity | null;
  createdAt: string;
};
export type ThreadSummary = {
  id: string;
  intent: Intent;
  otherIdentity: Identity | null;
  ownRevealed: boolean;
  createdAt: string;
  lastMessage: string | null;
};
export type Message = {
  id: string;
  text: string;
  isMine: boolean;
  createdAt: string;
};
export type ThreadResponse = { thread: ThreadSummary; messages: Message[] };
export type BlockItem = { id: string; label: string; createdAt: string };

/**
 * Authenticated REST endpoints under /api/get-even. JSON responses:
 * GET /me -> MeResponse (401 if unauthenticated)
 * PUT /profile {name,phone,intent,photos:string[],ageConfirmed:true} -> {profile:Profile}
 * GET /sent -> {items:Receipt[]}
 * POST /probes {phone,intent,mode,clientId} -> {receiptId:string,status:"Sent"}
 * GET /inbox -> {items:InboxItem[]}
 * POST /inbox/:id/ignore -> {ok:true}
 * POST /inbox/:id/accept {message} -> {threadId:string}
 * POST /inbox/:id/block -> {ok:true}
 * POST /inbox/:id/report {reason,includeContent:boolean} -> {ok:true}
 * GET /threads -> {items:ThreadSummary[]}
 * GET /threads/:id -> ThreadResponse
 * POST /threads/:id/messages {text,clientId} -> {ok:true}
 * POST /threads/:id/reveal {confirm:true} -> {ok:true}
 * POST /threads/:id/block -> {ok:true}
 * POST /threads/:id/report {reason,includeContent:boolean} -> {ok:true}
 * GET /blocks -> {items:BlockItem[]}
 * DELETE /blocks/:id -> {ok:true}
 * DELETE /inbox -> {ok:true}
 * DELETE /profile -> {ok:true} (deletes Get Even data, not the Manus account)
 * POST /logout -> {ok:true} (revokes current session)
 * Sensitive content must not appear in anonymous receiver records or sender receipts.
 */

export const MAX_MASS_RECIPIENTS = 20;
export const MAX_LOCAL_CONTACTS = 200;
export const SAMPLE_PHONES = [
  "+14155550101",
  "+14155550102",
  "+14155550103",
] as const;
export type MassProbeContact = {
  phone: string;
};
export type MassProbeInput = {
  contacts: MassProbeContact[];
  intent: Intent;
  mode: IdentityMode;
  clientId: string;
};
export type MassProbeResponse = {
  batchId: string;
  status: "Sent";
  submittedCount: number;
};
// POST /probes/mass -> MassProbeResponse. Submitted count reflects input, never members/matches/delivery.
// Contact labels/sample markers are rejected by the API; only phone-only entries are accepted.
// No reciprocal probe lookup occurs before voluntary participation.
