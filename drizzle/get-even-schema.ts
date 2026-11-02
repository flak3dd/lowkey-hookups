import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** Postgres enum types are database-wide, so shared column enums are declared once. */
export const intentEnum = pgEnum("get_even_intent", ["Kiss"]);
export const sendModeEnum = pgEnum("get_even_mode", ["anonymous", "named"]);
export const routingStatusEnum = pgEnum("get_even_routing_status", [
  "pending",
  "processing",
  "processed",
]);
export const probeStateEnum = pgEnum("get_even_probe_state", [
  "open",
  "ignored",
  "accepted",
  "blocked",
]);
export const reportSubjectTypeEnum = pgEnum("get_even_report_subject_type", [
  "probe",
  "thread",
]);

/**
 * Get Even data is deliberately separate from Manus authentication records. Payload
 * columns are encrypted application envelopes; phone equality is a keyed HMAC index.
 */
export const getEvenProfiles = pgTable(
  "getEvenProfiles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerUserId: integer("ownerUserId").notNull(),
    /** Changes whenever a person deletes and creates a new Get Even profile. */
    incarnationId: varchar("incarnationId", { length: 36 }).notNull(),
    phoneHmac: varchar("phoneHmac", { length: 64 }).notNull(),
    /** Last time this account bound its current phone index. */
    phoneBoundAt: timestamp("phoneBoundAt", { precision: 3 }).notNull(),
    intent: intentEnum("intent").notNull(),
    payloadCiphertext: text("payloadCiphertext").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("getEvenProfiles_ownerUserId_unique").on(table.ownerUserId),
    index("getEvenProfiles_phoneHmac_idx").on(table.phoneHmac),
  ],
);

/** Opaque, sender-owned submission acknowledgement and routing work item. */
export const getEvenReceipts = pgTable(
  "getEvenReceipts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    senderUserId: integer("senderUserId").notNull(),
    senderProfileId: varchar("senderProfileId", { length: 36 }).notNull(),
    clientId: varchar("clientId", { length: 96 }).notNull(),
    targetPhoneHmac: varchar("targetPhoneHmac", { length: 64 }).notNull(),
    intent: intentEnum("intent").notNull(),
    mode: sendModeEnum("mode").notNull(),
    /** Includes the target number and (only for named mode) sender identity snapshot. */
    payloadCiphertext: text("payloadCiphertext").notNull(),
    routingStatus: routingStatusEnum("routingStatus")
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
    routedAt: timestamp("routedAt", { precision: 3 }),
  },
  (table) => [
    uniqueIndex("getEvenReceipts_sender_client_unique").on(
      table.senderUserId,
      table.clientId,
    ),
    index("getEvenReceipts_sender_created_idx").on(
      table.senderUserId,
      table.createdAt,
    ),
    index("getEvenReceipts_route_idx").on(table.routingStatus, table.createdAt),
  ],
);

/** A recipient-owned first-contact item. Anonymous items carry no identity payload. */
export const getEvenProbes = pgTable(
  "getEvenProbes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    receiptId: varchar("receiptId", { length: 36 }).notNull(),
    recipientUserId: integer("recipientUserId").notNull(),
    recipientProfileId: varchar("recipientProfileId", { length: 36 }).notNull(),
    recipientIncarnationId: varchar("recipientIncarnationId", {
      length: 36,
    }).notNull(),
    /** Internal linkage supports safety controls but is never serialized to clients. */
    senderUserId: integer("senderUserId").notNull(),
    senderProfileId: varchar("senderProfileId", { length: 36 }).notNull(),
    intent: intentEnum("intent").notNull(),
    mode: sendModeEnum("mode").notNull(),
    identityCiphertext: text("identityCiphertext"),
    state: probeStateEnum("state").default("open").notNull(),
    threadId: varchar("threadId", { length: 36 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  (table) => [
    uniqueIndex("getEvenProbes_receipt_unique").on(table.receiptId),
    index("getEvenProbes_recipient_state_expiry_idx").on(
      table.recipientUserId,
      table.state,
      table.expiresAt,
    ),
  ],
);

/** A reciprocal anonymous-probe candidate. Chat is unavailable until both users guess correctly. */
export const getEvenCandidates = pgTable(
  "getEvenCandidates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    probeAId: varchar("probeAId", { length: 36 }).notNull(),
    probeBId: varchar("probeBId", { length: 36 }).notNull(),
    participantAUserId: integer("participantAUserId").notNull(),
    participantBUserId: integer("participantBUserId").notNull(),
    participantAGuessCount: integer("participantAGuessCount").default(0).notNull(),
    participantBGuessCount: integer("participantBGuessCount").default(0).notNull(),
    participantACorrect: boolean("participantACorrect").default(false).notNull(),
    participantBCorrect: boolean("participantBCorrect").default(false).notNull(),
    lockedUntil: timestamp("lockedUntil", { precision: 3 }),
    threadId: varchar("threadId", { length: 36 }),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("getEvenCandidates_probe_pair_unique").on(table.probeAId, table.probeBId),
    index("getEvenCandidates_participantA_updated_idx").on(table.participantAUserId, table.updatedAt),
    index("getEvenCandidates_participantB_updated_idx").on(table.participantBUserId, table.updatedAt),
  ],
);
/** A private conversation whose participant identities are revealed on mutual unlock. */
export const getEvenThreads = pgTable(
  "getEvenThreads",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    intent: intentEnum("intent").notNull(),
    participantAUserId: integer("participantAUserId").notNull(),
    participantBUserId: integer("participantBUserId").notNull(),
    participantAIdentityCiphertext: text("participantAIdentityCiphertext"),
    participantBIdentityCiphertext: text("participantBIdentityCiphertext"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("getEvenThreads_participantA_updated_idx").on(
      table.participantAUserId,
      table.updatedAt,
    ),
    index("getEvenThreads_participantB_updated_idx").on(
      table.participantBUserId,
      table.updatedAt,
    ),
  ],
);

/** Shared encrypted messages; delivery suppression prevents a block oracle. */
export const getEvenMessages = pgTable(
  "getEvenMessages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    threadId: varchar("threadId", { length: 36 }).notNull(),
    senderUserId: integer("senderUserId").notNull(),
    clientId: varchar("clientId", { length: 96 }).notNull(),
    payloadCiphertext: text("payloadCiphertext").notNull(),
    suppressedForUserId: integer("suppressedForUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("getEvenMessages_thread_sender_client_unique").on(
      table.threadId,
      table.senderUserId,
      table.clientId,
    ),
    index("getEvenMessages_thread_created_idx").on(
      table.threadId,
      table.createdAt,
    ),
  ],
);

/** Minimal durable account-to-account safety relationship. Labels never identify an anonymous sender. */
export const getEvenBlocks = pgTable(
  "getEvenBlocks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerUserId: integer("ownerUserId").notNull(),
    blockedUserId: integer("blockedUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("getEvenBlocks_owner_blocked_unique").on(
      table.ownerUserId,
      table.blockedUserId,
    ),
    index("getEvenBlocks_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt,
    ),
  ],
);

/** Private safety report metadata plus optional, consented encrypted evidence snapshot. */
export const getEvenReports = pgTable(
  "getEvenReports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    reporterUserId: integer("reporterUserId").notNull(),
    subjectType: reportSubjectTypeEnum("subjectType").notNull(),
    subjectId: varchar("subjectId", { length: 36 }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    includeContent: boolean("includeContent").default(false).notNull(),
    evidenceCiphertext: text("evidenceCiphertext"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("getEvenReports_reporter_created_idx").on(
      table.reporterUserId,
      table.createdAt,
    ),
  ],
);

export type GetEvenProfileRow = typeof getEvenProfiles.$inferSelect;
export type GetEvenReceiptRow = typeof getEvenReceipts.$inferSelect;
export type GetEvenProbeRow = typeof getEvenProbes.$inferSelect;
export type GetEvenCandidateRow = typeof getEvenCandidates.$inferSelect;
export type GetEvenThreadRow = typeof getEvenThreads.$inferSelect;
export type GetEvenMessageRow = typeof getEvenMessages.$inferSelect;

/** SMS phone verification records ensuring ownership of self-declared numbers. */
export const getEvenPhoneVerifications = pgTable(
  "getEvenPhoneVerifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    phone: varchar("phone", { length: 32 }).notNull(),
    codeHash: varchar("codeHash", { length: 64 }).notNull(),
    verificationToken: varchar("verificationToken", { length: 64 }),
    attempts: integer("attempts").default(0).notNull(),
    verified: boolean("verified").default(false).notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    verifiedAt: timestamp("verifiedAt", { precision: 3 }),
  },
  (table) => [
    index("getEvenPhoneVerifications_phone_idx").on(table.phone),
    index("getEvenPhoneVerifications_token_idx").on(table.verificationToken),
  ],
);

export type GetEvenPhoneVerificationRow =
  typeof getEvenPhoneVerifications.$inferSelect;
