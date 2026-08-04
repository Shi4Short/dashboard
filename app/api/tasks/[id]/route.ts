import { NextRequest, NextResponse } from "next/server";
import { checkMilestoneAutoComplete, ensureSchema, logCompletion, rowToTask, sql } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const body = await request.json();

  if (typeof body.done === "boolean") {
    const [existing] = await sql`SELECT done FROM tasks WHERE id = ${id}`;
    const rows = await sql`UPDATE tasks SET done = ${body.done} WHERE id = ${id} RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (body.done && !existing?.done) {
      await logCompletion(rows[0].title as string);
      if (rows[0].project_milestone_id) await checkMilestoneAutoComplete(rows[0].project_milestone_id as string);
    }
    return NextResponse.json(rowToTask(rows[0]));
  }
  if (typeof body.date === "string") {
    const rows = body.incrementPush
      ? await sql`UPDATE tasks SET date = ${body.date}, push_count = push_count + 1 WHERE id = ${id} RETURNING *`
      : await sql`UPDATE tasks SET date = ${body.date} WHERE id = ${id} RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(rowToTask(rows[0]));
  }
  if (typeof body.category === "string") {
    const rows = await sql`UPDATE tasks SET category = ${body.category} WHERE id = ${id} RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(rowToTask(rows[0]));
  }
  if (typeof body.time === "string") {
    const rows = await sql`UPDATE tasks SET time = ${body.time} WHERE id = ${id} RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(rowToTask(rows[0]));
  }
  if (body.projectMilestoneId === null || typeof body.projectMilestoneId === "string") {
    const rows = await sql`
      UPDATE tasks SET project_milestone_id = ${body.projectMilestoneId} WHERE id = ${id} RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    // A task can arrive at a milestone already done (e.g. reassigning a
    // completed task), so re-check whether that just completes the milestone.
    if (body.projectMilestoneId && rows[0].done) await checkMilestoneAutoComplete(body.projectMilestoneId as string);
    return NextResponse.json(rowToTask(rows[0]));
  }
  return NextResponse.json({ error: "no supported fields in body" }, { status: 400 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
