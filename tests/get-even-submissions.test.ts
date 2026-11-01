import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

// Explicit isolated test double. Production still uses the live managed database.
const state = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  tail: Promise.resolve() as Promise<unknown>,
  lockCount: 0,
  transactions: 0,
}));
vi.mock("../server/get-even/crypto", () => ({
  encryptPayload: (value: unknown) => JSON.stringify(value),
  phoneHmac: (value: string) => `test-hmac:${value}`,
}));
vi.mock("../server/get-even/serializers", () => ({
  profileResponse: () => ({
    name: "Test person",
    phone: "+14155552671",
    intent: "Kiss",
    photos: [],
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
            state.lockCount++;
          },
          select: (fields?: Record<string, unknown>) => {
            let table: any;
            let params: unknown[] = [];
            const rows = () => {
              if (!locked)
                throw new Error("Submission queries must follow a sender lock");
              if (getTableName(table) === "getEvenProfiles")
                return [{ id: "profile-7", ownerUserId: 7 }];
              if (fields?.value) return [{ value: state.rows.size }];
              const key = params.find(
                (value) => typeof value === "string",
              ) as string;
              const item = state.rows.get(key);
              return item ? [{ id: item.id }] : [];
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
          insert: () => ({
            values: (row: any) => ({
              onConflictDoNothing: async () => {
                if (!locked) throw new Error("Insert must be guarded");
                if (!state.rows.has(row.clientId))
                  state.rows.set(row.clientId, row);
              },
            }),
          }),
        };
        return callback(tx);
      });
      state.tail = result.catch(() => undefined);
      return result;
    },
  }),
}));

import { createSubmission } from "../server/get-even/profiles";
const actor = { id: 7, name: "Test person" };
function input(clientId: string, mode: "anonymous" | "named" = "anonymous") {
  return { phone: "+14155552672", intent: "Kiss" as const, mode, clientId };
}
beforeEach(() => {
  state.rows.clear();
  state.tail = Promise.resolve();
  state.lockCount = 0;
  state.transactions = 0;
});
describe("atomic Get Even submission creation", () => {
  it("keeps 24 simultaneous distinct requests within the 20-per-day sender cap", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 24 }, (_, i) =>
        createSubmission(actor, input(`parallel-${i}`)),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(20);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(4);
    expect(state.rows.size).toBe(20);
    expect(state.transactions).toBe(24);
    expect(state.lockCount).toBe(24);
  });
  it("returns the original accepted receipt on a retry even after the quota is full", async () => {
    const first = await createSubmission(actor, input("retry-original"));
    for (let i = 0; i < 19; i++)
      await createSubmission(actor, input(`other-${i}`));
    expect(await createSubmission(actor, input("retry-original"))).toEqual(
      first,
    );
    expect(state.rows.size).toBe(20);
  });
  it("records the per-send intent and snapshots the standing intent in a named identity", async () => {
    await createSubmission(actor, input("named", "named"));
    const row = state.rows.get("named");
    expect(row.intent).toBe("Kiss");
    expect(JSON.parse(row.payloadCiphertext).senderIdentity.intent).toBe(
      "Kiss",
    );
  });
});
