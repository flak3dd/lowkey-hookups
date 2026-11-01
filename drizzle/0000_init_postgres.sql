CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."get_even_intent" AS ENUM('Kiss');--> statement-breakpoint
CREATE TYPE "public"."get_even_probe_state" AS ENUM('open', 'ignored', 'accepted', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."get_even_report_subject_type" AS ENUM('probe', 'thread');--> statement-breakpoint
CREATE TYPE "public"."get_even_routing_status" AS ENUM('pending', 'processing', 'processed');--> statement-breakpoint
CREATE TYPE "public"."get_even_mode" AS ENUM('anonymous', 'named');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "getEvenBlocks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"ownerUserId" integer NOT NULL,
	"blockedUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "getEvenMessages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"threadId" varchar(36) NOT NULL,
	"senderUserId" integer NOT NULL,
	"clientId" varchar(96) NOT NULL,
	"payloadCiphertext" text NOT NULL,
	"suppressedForUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "getEvenProbes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"receiptId" varchar(36) NOT NULL,
	"recipientUserId" integer NOT NULL,
	"recipientProfileId" varchar(36) NOT NULL,
	"recipientIncarnationId" varchar(36) NOT NULL,
	"senderUserId" integer NOT NULL,
	"senderProfileId" varchar(36) NOT NULL,
	"intent" "get_even_intent" NOT NULL,
	"mode" "get_even_mode" NOT NULL,
	"identityCiphertext" text,
	"state" "get_even_probe_state" DEFAULT 'open' NOT NULL,
	"threadId" varchar(36),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "getEvenProfiles" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"ownerUserId" integer NOT NULL,
	"incarnationId" varchar(36) NOT NULL,
	"phoneHmac" varchar(64) NOT NULL,
	"phoneBoundAt" timestamp (3) NOT NULL,
	"intent" "get_even_intent" NOT NULL,
	"payloadCiphertext" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "getEvenReceipts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"senderUserId" integer NOT NULL,
	"senderProfileId" varchar(36) NOT NULL,
	"clientId" varchar(96) NOT NULL,
	"targetPhoneHmac" varchar(64) NOT NULL,
	"intent" "get_even_intent" NOT NULL,
	"mode" "get_even_mode" NOT NULL,
	"payloadCiphertext" text NOT NULL,
	"routingStatus" "get_even_routing_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"routedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "getEvenReports" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"reporterUserId" integer NOT NULL,
	"subjectType" "get_even_report_subject_type" NOT NULL,
	"subjectId" varchar(36) NOT NULL,
	"reason" varchar(240) NOT NULL,
	"includeContent" boolean DEFAULT false NOT NULL,
	"evidenceCiphertext" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "getEvenThreads" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"intent" "get_even_intent" NOT NULL,
	"participantAUserId" integer NOT NULL,
	"participantBUserId" integer NOT NULL,
	"participantAIdentityCiphertext" text,
	"participantBIdentityCiphertext" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "getEvenBatches" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"senderUserId" integer NOT NULL,
	"clientId" varchar(96) NOT NULL,
	"inputFingerprint" varchar(64) NOT NULL,
	"submittedCount" integer NOT NULL,
	"createdAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authFlows" (
	"flowId" varchar(128) PRIMARY KEY NOT NULL,
	"verifierHash" varchar(64) NOT NULL,
	"redirectUri" varchar(2048) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revokedSessions" (
	"tokenHash" varchar(64) PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "getEvenBlocks_owner_blocked_unique" ON "getEvenBlocks" USING btree ("ownerUserId","blockedUserId");--> statement-breakpoint
CREATE INDEX "getEvenBlocks_owner_created_idx" ON "getEvenBlocks" USING btree ("ownerUserId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "getEvenMessages_thread_sender_client_unique" ON "getEvenMessages" USING btree ("threadId","senderUserId","clientId");--> statement-breakpoint
CREATE INDEX "getEvenMessages_thread_created_idx" ON "getEvenMessages" USING btree ("threadId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "getEvenProbes_receipt_unique" ON "getEvenProbes" USING btree ("receiptId");--> statement-breakpoint
CREATE INDEX "getEvenProbes_recipient_state_expiry_idx" ON "getEvenProbes" USING btree ("recipientUserId","state","expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "getEvenProfiles_ownerUserId_unique" ON "getEvenProfiles" USING btree ("ownerUserId");--> statement-breakpoint
CREATE INDEX "getEvenProfiles_phoneHmac_idx" ON "getEvenProfiles" USING btree ("phoneHmac");--> statement-breakpoint
CREATE UNIQUE INDEX "getEvenReceipts_sender_client_unique" ON "getEvenReceipts" USING btree ("senderUserId","clientId");--> statement-breakpoint
CREATE INDEX "getEvenReceipts_sender_created_idx" ON "getEvenReceipts" USING btree ("senderUserId","createdAt");--> statement-breakpoint
CREATE INDEX "getEvenReceipts_route_idx" ON "getEvenReceipts" USING btree ("routingStatus","createdAt");--> statement-breakpoint
CREATE INDEX "getEvenReports_reporter_created_idx" ON "getEvenReports" USING btree ("reporterUserId","createdAt");--> statement-breakpoint
CREATE INDEX "getEvenThreads_participantA_updated_idx" ON "getEvenThreads" USING btree ("participantAUserId","updatedAt");--> statement-breakpoint
CREATE INDEX "getEvenThreads_participantB_updated_idx" ON "getEvenThreads" USING btree ("participantBUserId","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "getEvenBatches_sender_client_unique" ON "getEvenBatches" USING btree ("senderUserId","clientId");--> statement-breakpoint
CREATE INDEX "getEvenBatches_sender_created_idx" ON "getEvenBatches" USING btree ("senderUserId","createdAt");