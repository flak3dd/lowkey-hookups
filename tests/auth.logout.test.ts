import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const databaseMock = vi.hoisted(() => {
  const insertedRows: Array<Record<string, unknown>> = [];
  const onConflictDoUpdate = vi.fn(async () => undefined);
  const values = vi.fn((row: Record<string, unknown>) => {
    insertedRows.push(row);
    return { onConflictDoUpdate };
  });
  const insert = vi.fn(() => ({ values }));
  return {
    insertedRows,
    onConflictDoUpdate,
    values,
    insert,
    getDb: vi.fn(async () => ({ insert })),
  };
});

vi.mock("../server/db", () => ({
  getDb: databaseMock.getDb,
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

import { revokeCurrentSession } from "../server/_core/oauth";
import { sdk } from "../server/_core/sdk";
import { getSessionCookieName } from "../server/_core/cookies";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

describe("auth.logout", () => {
  beforeEach(() => {
    databaseMock.insertedRows.splice(0);
    databaseMock.insert.mockClear();
    databaseMock.values.mockClear();
    databaseMock.onConflictDoUpdate.mockClear();
  });

  it("persists only a SHA-256 session hash and clears the app cookie", async () => {
    const token = await sdk.createSessionToken("sample-user", { name: "Sample User" });
    const verified = await sdk.verifySession(token);
    expect(verified).not.toBeNull();

    const clearedCookies: CookieCall[] = [];
    const req = {
      protocol: "https",
      hostname: "3000-preview.example.test",
      headers: { authorization: `Bearer ${token}` },
    } as unknown as Request;
    const res = {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as Response;

    await revokeCurrentSession(req, res);

    expect(databaseMock.insert).toHaveBeenCalledTimes(1);
    expect(databaseMock.insertedRows).toHaveLength(1);
    expect(databaseMock.insertedRows[0]).toMatchObject({ expiresAt: verified?.expiresAt });
    expect(databaseMock.insertedRows[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(databaseMock.insertedRows[0]?.tokenHash).not.toBe(token);
    expect(clearedCookies).toEqual([
      {
        name: getSessionCookieName(req),
        options: expect.objectContaining({
          maxAge: -1,
          secure: true,
          sameSite: "none",
          httpOnly: true,
          path: "/",
        }),
      },
    ]);
  });
});
