import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

// Explicit isolated transaction double. Production uses the managed database.
const state = vi.hoisted(() => ({
  receipts: new Map<string, any>(),
  batches: new Map<string, any>(),
  tail: Promise.resolve() as Promise<unknown>,
  locks: 0,
  transactions: 0,
  selectedTables: [] as string[],
  insertedTables: [] as string[],
  profile: {
    id: "profile-7",
    ownerUserId: 7,
    phoneHmac: "test-hmac:+14155552671",
    intent: "Kiss",
    payloadCiphertext: "profile-ciphertext",
  },
}));

vi.mock("../server/get-even/crypto", () => ({
  encryptPayload: (value: unknown) => JSON.stringify(value),
  phoneHmac: (value: string) => `test-hmac:${value}`,
}));
vi.mock("../server/get-even/serializers", () => ({
  profileResponse: (row: any) => ({
    name: "Standing sender",
    phone: "+14155552671",
    intent: row.intent,
    photos: ["data:image/jpeg;base64,standing-photo"],
  }),
  receiptResponse: (value: unknown) => value,
}));
vi.mock("../server/db", () => ({
  getDb: async () => ({
    transaction: (callback: (tx: any) => Promise<unknown>) => {
      state.transactions++;
      const result = state.tail.then(async () => {
        let locked = false;
        const tx = {
          execute: async () => {
            locked = true;
            state.locks++;
          },
          select: (fields?: Record<string, unknown>) => {
            let table: any;
            let params: unknown[] = [];
            const rows = () => {
              if (!locked)
                throw new Error("Mass queries must follow a sender lock");
              const tableName = getTableName(table);
              state.selectedTables.push(tableName);
              if (tableName === "getEvenProfiles") return [state.profile];
              if (tableName === "getEvenBatches") {
                const clientId = params
                  .filter((value) => typeof value === "string")
                  .at(-1) as string;
                const batch = state.batches.get(clientId);
                return batch ? [batch] : [];
              }
              if (tableName === "getEvenReceipts") {
                if (fields?.value) return [{ value: state.receipts.size }];
                const clientId = params
                  .filter((value) => typeof value === "string")
                  .at(-1) as string;
                const receipt = state.receipts.get(clientId);
                return receipt ? [{ id: receipt.id }] : [];
              }
              throw new Error(`Unexpected selected table: ${tableName}`);
            };
            const query: any = {
              from: (value: any) => {
                table = value;
                return query;
              },
              where: (condition: any) => {
                params = new PgDialect().sqlToQuery(condition).params;
                return query;
              },
              limit: async () => rows(),
              then: (resolve: any, reject: any) =>
                Promise.resolve().then(rows).then(resolve, reject),
            };
            return query;
          },
          insert: (table: any) => ({
            values: (value: any) => {
              let applied = false;
              const apply = () => {
                if (applied) return;
                if (!locked) throw new Error("Mass inserts must be guarded");
                applied = true;
                const tableName = getTableName(table);
                state.insertedTables.push(tableName);
                if (tableName === "getEvenReceipts") {
                  for (const row of Array.isArray(value) ? value : [value]) {
                    if (!state.receipts.has(row.clientId))
                      state.receipts.set(row.clientId, row);
                  }
                  return;
                }
                if (tableName === "getEvenBatches") {
                  state.batches.set(value.clientId, value);
                  return;
                }
                throw new Error(`Unexpected inserted table: ${tableName}`);
              };
              return {
                then: (resolve: any, reject: any) =>
                  Promise.resolve().then(apply).then(resolve, reject),
                onConflictDoNothing: async () => apply(),
              };
            },
          }),
        };
        return callback(tx);
      });
      state.tail = result.catch(() => undefined);
      return result;
    },
  }),
}));

import {
  createMassSubmission,
  createSubmission,
} from "../server/get-even/profiles";
import { validateMassProbeInput } from "../server/get-even/validation";

const actor = { id: 7, name: "Standing sender" };

function massInput(
  clientId: string,
  contacts: Array<{ phone: string }> = [{ phone: "+14155552672" }],
  intent: "Kiss" = "Kiss",
  mode: "anonymous" | "named" = "anonymous",
) {
  const result = validateMassProbeInput({ contacts, intent, mode, clientId });
  if (!result) throw new Error("Test input should be valid");
  return result;
}

function singleInput(clientId: string) {
  return {
    phone: "+14155552799",
    intent: "Kiss" as const,
    mode: "anonymous" as const,
    clientId,
  };
}

function seedReceipts(count: number) {
  for (let index = 0; index < count; index++) {
    state.receipts.set(`seed-${index}`, {
      id: `seed-${index}`,
      clientId: `seed-${index}`,
    });
  }
}

beforeEach(() => {
  state.receipts.clear();
  state.batches.clear();
  state.tail = Promise.resolve();
  state.locks = 0;
  state.transactions = 0;
  state.selectedTables = [];
  state.insertedTables = [];
  state.profile = {
    id: "profile-7",
    ownerUserId: 7,
    phoneHmac: "test-hmac:+14155552671",
    intent: "Kiss",
    payloadCiphertext: "profile-ciphertext",
  };
});

describe("Get Even mass probe validation", () => {
  it("caps raw input, canonicalizes/deduplicates phones, and rejects labels, extra fields and samples", () => {
    expect(
      validateMassProbeInput({
        contacts: [{ phone: " +1 (415) 555-2672 " }, { phone: "+14155552672" }],
        intent: "Kiss",
        mode: "anonymous",
        clientId: "canonical",
      }),
    ).toEqual({
      contacts: [{ phone: "+14155552672" }],
      intent: "Kiss",
      mode: "anonymous",
      clientId: "canonical",
    });
    expect(
      validateMassProbeInput({
        contacts: Array.from({ length: 21 }, () => ({ phone: "+14155552672" })),
        intent: "Kiss",
        mode: "anonymous",
        clientId: "too-many-raw",
      }),
    ).toBeNull();
    expect(
      validateMassProbeInput({
        contacts: [{ phone: "+14155552672", sample: true }],
        intent: "Kiss",
        mode: "anonymous",
        clientId: "sample-flag",
      }),
    ).toBeNull();
    expect(
      validateMassProbeInput({
        contacts: [{ phone: "+14155550101" }],
        intent: "Kiss",
        mode: "anonymous",
        clientId: "sample-number",
      }),
    ).toBeNull();
    expect(
      validateMassProbeInput({
        contacts: [{ phone: "+14155552672", name: "x".repeat(81) }],
        intent: "Kiss",
        mode: "anonymous",
        clientId: "long-label",
      }),
    ).toBeNull();
    for (const extra of [
      { name: "A B" },
      { sample: false },
      { label: "Local label" },
    ]) {
      expect(
        validateMassProbeInput({
          contacts: [{ phone: "+14155552672", ...extra }],
          intent: "Kiss",
          mode: "anonymous",
          clientId: "unexpected",
        }),
      ).toBeNull();
    }
  });

  it("accepts only the Kiss intent and rejects the retired Hook up / Date / Chat values", () => {
    for (const intent of ["Hook up", "Date", "Chat"]) {
      expect(
        validateMassProbeInput({
          contacts: [{ phone: "+14155552672" }],
          intent,
          mode: "anonymous",
          clientId: `legacy-${intent}`,
        }),
      ).toBeNull();
    }
  });
});

describe("atomic Get Even mass submission creation", () => {
  it("excludes self after canonical deduplication and persists neither contact labels nor receiver identity", async () => {
    const result = await createMassSubmission(
      actor,
      massInput(
        "self-and-label",
        [
          { phone: "+14155552671" },
          { phone: "+14155552672" },
          { phone: "+1 (415) 555-2672" },
        ],
        "Kiss",
        "named",
      ),
    );

    expect(result).toMatchObject({ status: "Sent", submittedCount: 1 });
    expect(state.receipts).toHaveLength(1);
    const receipt = [...state.receipts.values()][0];
    expect(receipt.targetPhoneHmac).toBe("test-hmac:+14155552672");
    const payload = JSON.parse(receipt.payloadCiphertext);
    expect(payload.senderIdentity).toEqual({
      name: "Standing sender",
      intent: "Kiss",
      photos: ["data:image/jpeg;base64,standing-photo"],
    });
    expect(payload.senderIdentity).not.toHaveProperty("phone");
    expect(
      JSON.stringify([...state.receipts.values(), ...state.batches.values()]),
    ).not.toContain("Address book person");
    expect(state.selectedTables).not.toContain("getEvenProbes");
    expect(state.selectedTables).not.toContain("getEvenBlocks");
    expect(state.selectedTables).not.toContain("getEvenThreads");
  });

  it("rejects a quota-overflowing batch without inserting any portion of it", async () => {
    seedReceipts(19);
    await expect(
      createMassSubmission(
        actor,
        massInput("all-or-none", [
          { phone: "+14155552672" },
          { phone: "+14155552673" },
        ]),
      ),
    ).rejects.toThrow("Submission limit reached");
    expect(state.receipts).toHaveLength(19);
    expect(state.batches).toHaveLength(0);
  });

  it("serializes concurrent batches and singles against one shared 20-send budget", async () => {
    const batches = Array.from({ length: 5 }, (_, index) =>
      createMassSubmission(
        actor,
        massInput(`concurrent-batch-${index}`, [
          { phone: `+14155552${700 + index * 3}` },
          { phone: `+14155552${701 + index * 3}` },
          { phone: `+14155552${702 + index * 3}` },
        ]),
      ),
    );
    const singles = Array.from({ length: 10 }, (_, index) =>
      createSubmission(actor, singleInput(`concurrent-single-${index}`)),
    );
    const results = await Promise.allSettled([...batches, ...singles]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(10);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(5);
    expect(state.receipts).toHaveLength(20);
    expect(state.batches).toHaveLength(5);
    expect(state.locks).toBe(15);
  });

  it("returns an exact batch retry before quota evaluation when the quota is full", async () => {
    const first = await createMassSubmission(
      actor,
      massInput("retry-at-full", [
        { phone: "+14155552672" },
        { phone: "+14155552673" },
      ]),
    );
    for (let index = 0; index < 18; index++) {
      await createSubmission(actor, singleInput(`fill-${index}`));
    }

    await expect(
      createMassSubmission(
        actor,
        massInput("retry-at-full", [
          { phone: "+14155552672" },
          { phone: "+14155552673" },
        ]),
      ),
    ).resolves.toEqual(first);
    expect(state.receipts).toHaveLength(20);
    expect(state.batches).toHaveLength(1);
  });

  it("rejects a reused client id with different semantic payload without new sends", async () => {
    await createMassSubmission(
      actor,
      massInput("changed", [{ phone: "+14155552672" }]),
    );
    await expect(
      createMassSubmission(
        actor,
        massInput("changed", [{ phone: "+14155552673" }]),
      ),
    ).rejects.toThrow("Submission unavailable");
    expect(state.receipts).toHaveLength(1);
    expect(state.batches).toHaveLength(1);
  });
});
