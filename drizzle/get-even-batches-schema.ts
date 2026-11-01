import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Sender-owned acknowledgement for one all-or-nothing contact batch. This table
 * deliberately contains neither contact labels nor recipient phone numbers.
 */
export const getEvenBatches = pgTable(
  "getEvenBatches",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    senderUserId: integer("senderUserId").notNull(),
    clientId: varchar("clientId", { length: 96 }).notNull(),
    /** Keyed fingerprint of sorted recipient phone HMACs plus intent and mode. */
    inputFingerprint: varchar("inputFingerprint", { length: 64 }).notNull(),
    submittedCount: integer("submittedCount").notNull(),
    /** Explicitly supplied by the acknowledgement transaction for fsp compatibility. */
    createdAt: timestamp("createdAt", { precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex("getEvenBatches_sender_client_unique").on(
      table.senderUserId,
      table.clientId,
    ),
    index("getEvenBatches_sender_created_idx").on(
      table.senderUserId,
      table.createdAt,
    ),
  ],
);

export type GetEvenBatchRow = typeof getEvenBatches.$inferSelect;
