CREATE TABLE IF NOT EXISTS "getEvenCandidates" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "probeAId" varchar(36) NOT NULL,
  "probeBId" varchar(36) NOT NULL,
  "participantAUserId" integer NOT NULL,
  "participantBUserId" integer NOT NULL,
  "participantAGuessCount" integer DEFAULT 0 NOT NULL,
  "participantBGuessCount" integer DEFAULT 0 NOT NULL,
  "participantACorrect" boolean DEFAULT false NOT NULL,
  "participantBCorrect" boolean DEFAULT false NOT NULL,
  "lockedUntil" timestamp(3),
  "threadId" varchar(36),
  "createdAt" timestamp(3) DEFAULT now() NOT NULL,
  "updatedAt" timestamp(3) DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "getEvenCandidates_probe_pair_unique" ON "getEvenCandidates" ("probeAId", "probeBId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "getEvenCandidates_participantA_updated_idx" ON "getEvenCandidates" ("participantAUserId", "updatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "getEvenCandidates_participantB_updated_idx" ON "getEvenCandidates" ("participantBUserId", "updatedAt");--> statement-breakpoint
ALTER TABLE "getEvenCandidates" ENABLE ROW LEVEL SECURITY;