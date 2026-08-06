import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Read-only diagnostic: lists tasks sharing the same title + date, the
// classic signature of a leftover duplicate row from before the Notion/
// Calendar cross-source dedup fix. Two rows with the same title on the
// same day render as two separate checkboxes that look identical, so
// toggling one while the other sits unchanged can look exactly like a
// single checkbox flickering.
export async function GET() {
  await ensureSchema();
  const rows = await sql`
    SELECT title, date, array_agg(id) AS ids, array_agg(done) AS done_states, count(*) AS n
    FROM tasks
    GROUP BY title, date
    HAVING count(*) > 1
    ORDER BY date DESC
  `;
  return NextResponse.json({ duplicateGroups: rows.length, groups: rows });
}
