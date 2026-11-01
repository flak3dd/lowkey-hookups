-- Supabase exposes the public schema through its Data API to anyone holding the
-- publishable key. This app only talks to Postgres from the API server (as the
-- postgres role, which bypasses RLS), so enable RLS with no policies to deny
-- all Data API access to these tables.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "authFlows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "revokedSessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenProfiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenReceipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenProbes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenThreads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenMessages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenBlocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenReports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "getEvenBatches" ENABLE ROW LEVEL SECURITY;