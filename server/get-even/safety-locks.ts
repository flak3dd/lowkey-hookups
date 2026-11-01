import { sql } from "drizzle-orm";

/**
 * Profile rows are the stable per-account mutex for Get Even safety transitions.
 * Call only inside a database transaction, before evaluating or inserting blocks.
 */
export async function lockParticipantProfiles(tx: any, userIds: number[]): Promise<void> {
  const ordered = [...new Set(userIds)].sort((left, right) => left - right);
  for (const userId of ordered) {
    await tx.execute(
      sql`SELECT "id" FROM "getEvenProfiles" WHERE "ownerUserId" = ${userId} FOR UPDATE`,
    );
  }
}
