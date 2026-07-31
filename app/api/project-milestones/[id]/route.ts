import { NextRequest, NextResponse } from "next/server";
import { checkProjectMilestonesComplete, ensureSchema, logCompletion, rowToProjectMilestone, sql } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const { done } = await request.json();
  const [existing] = await sql`SELECT done, project_id FROM project_milestones WHERE id = ${id}`;
  const rows = await sql`UPDATE project_milestones SET done = ${done} WHERE id = ${id} RETURNING *`;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (done && !existing?.done) {
    await logCompletion(`Milestone complete: ${rows[0].title}`);
    await checkProjectMilestonesComplete(rows[0].project_id as string);
  }
  return NextResponse.json(rowToProjectMilestone(rows[0]));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM project_milestones WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
