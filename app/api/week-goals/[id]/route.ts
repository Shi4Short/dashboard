import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToWeekGoal } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const { done } = await request.json();
  const { rows } = await sql`UPDATE week_goals SET done = ${done} WHERE id = ${id} RETURNING *`;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(rowToWeekGoal(rows[0]));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  // The tasks.goal_id FK is ON DELETE SET NULL, so linked tasks are
  // automatically unlinked rather than deleted.
  await sql`DELETE FROM week_goals WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
