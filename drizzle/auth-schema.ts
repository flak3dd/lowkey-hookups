import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * A short-lived, single-use binding between an OAuth authorization request and
 * the browser/device that initiated it. The verifier itself is never stored.
 */
export const authFlows = pgTable("authFlows", {
  flowId: varchar("flowId", { length: 128 }).primaryKey(),
  verifierHash: varchar("verifierHash", { length: 64 }).notNull(),
  redirectUri: varchar("redirectUri", { length: 2048 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * SHA-256 hashes of application session JWTs that were explicitly logged out.
 * Rows become irrelevant when the corresponding JWT reaches expiresAt.
 */
export const revokedSessions = pgTable("revokedSessions", {
  tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
