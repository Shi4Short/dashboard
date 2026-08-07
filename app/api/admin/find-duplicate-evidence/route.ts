import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Read-only diagnostic: lists Evidence entries sharing the same text + date.
// A task's own completion can only ever log once (logCompletion only fires
// on a genuine not-done -> done transition), so an exact text+date repeat
// here means either a duplicate task row got checked off separately (see
// find-duplicate-tasks) or something re-logged the same completion twice.
export async function GET() {
  await ensureSchema();
  const rows = await sql`
    SELECT text, date, array_agg(id) AS ids, array_agg(task_id) AS task_ids, count(*) AS n
    FROM log_entries
    GROUP BY text, date
    HAVING count(*) > 1
    ORDER BY date DESC
  `;
  return NextResponse.json({ duplicateGroups: rows.length, groups: rows });
}
