import { describe, expect, it } from "vitest";
import { canAccessThread, isExpired, isVisibleToUser, selectSingleEligibleRecipient } from "../server/get-even/policy";
import { inboxResponse, threadResponse } from "../server/get-even/serializers";
import { canonicalPhone, validateProfileInput } from "../server/get-even/validation";

class ReceiptRetryDouble {
  private readonly ids = new Map<string, string>();

  submit(senderId: number, clientId: string): { receiptId: string; status: "Sent" } {
    const key = `${senderId}:${clientId}`;
    const existing = this.ids.get(key);
    if (existing) return { receiptId: existing, status: "Sent" };
    const id = `receipt-${this.ids.size + 1}`;
    this.ids.set(key, id);
    return { receiptId: id, status: "Sent" };
  }
}

const submittedAt = new Date("2026-11-01T00:00:00.000Z");

function anonymousProbe() {
  return {
    id: "probe-1",
    receiptId: "receipt-1",
    recipientUserId: 22,
    recipientProfileId: "profile-22",
    recipientIncarnationId: "incarnation-22",
    senderUserId: 11,
    senderProfileId: "profile-11",
    intent: "Kiss" as const,
    mode: "anonymous" as const,
    identityCiphertext: null,
    state: "open" as const,
    threadId: null,
    createdAt: submittedAt,
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
  };
}

describe("Get Even routing and privacy policy", () => {
  it("suppresses duplicate, self, and post-submission registrations", () => {
    expect(
      selectSingleEligibleRecipient(
        [
          { ownerUserId: 2, createdAt: new Date("2026-10-31T23:59:59.000Z") },
          { ownerUserId: 3, createdAt: new Date("2026-10-31T23:59:59.000Z") },
        ],
        1,
        submittedAt,
      ),
    ).toBeNull();
    expect(
      selectSingleEligibleRecipient([{ ownerUserId: 1, createdAt: new Date("2026-10-31T23:59:59.000Z") }], 1, submittedAt),
    ).toBeNull();
    expect(
      selectSingleEligibleRecipient([{ ownerUserId: 2, createdAt: new Date("2026-11-01T00:00:01.000Z") }], 1, submittedAt),
    ).toBeNull();
  });

  it("keeps anonymous inbox items free of identity fields and expires silently", () => {
    expect(inboxResponse(anonymousProbe())).toEqual({
      id: "probe-1",
      intent: "Kiss",
      mode: "anonymous",
      identity: null,
      createdAt: submittedAt.toISOString(),
    });
    expect(isExpired(new Date("2026-10-31T23:59:59.999Z"), submittedAt)).toBe(true);
    expect(isExpired(new Date("2026-11-01T00:00:00.001Z"), submittedAt)).toBe(false);
  });

  it("does not grant outsiders or blocked-message recipients thread content", () => {
    const thread = {
      id: "thread-1",
      intent: "Kiss" as const,
      participantAUserId: 1,
      participantBUserId: 2,
      participantAIdentityCiphertext: null,
      participantBIdentityCiphertext: null,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    };
    expect(canAccessThread(thread, 1)).toBe(true);
    expect(canAccessThread(thread, 3)).toBe(false);
    expect(isVisibleToUser({ senderUserId: 1, suppressedForUserId: 2 }, 1)).toBe(true);
    expect(isVisibleToUser({ senderUserId: 1, suppressedForUserId: 2 }, 2)).toBe(false);
    expect(threadResponse(thread, 1, null, null)).toMatchObject({ otherIdentity: null, ownRevealed: false });
  });

  it("returns the original acknowledgement for an in-memory retry and validates bounded signup input", () => {
    const repository = new ReceiptRetryDouble();
    const first = repository.submit(7, "client-1");
    expect(repository.submit(7, "client-1")).toEqual(first);
    expect(repository.submit(8, "client-1").receiptId).not.toBe(first.receiptId);
    expect(canonicalPhone(" +1 (415) 555-2671 ")).toBe("+14155552671");
    expect(
      validateProfileInput({
        name: "A",
        phone: "+14155552671",
        intent: "Kiss",
        photos: ["data:image/png;base64,AAA"],
        ageConfirmed: true,
      }),
    ).toBeNull();
  });
});
