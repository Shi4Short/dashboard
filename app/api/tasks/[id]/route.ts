import { NextRequest, NextResponse } from "next/server";
import { checkMilestoneAutoComplete, ensureSchema, logCompletion, rowToTask, sql } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const body = await request.json();

  const hasDone = typeof body.done === "boolean";
  const hasDate = typeof body.date === "string";
  const hasCategory = typeof body.category === "string";
  const hasTime = typeof body.time === "string";
  const hasMilestone = body.projectMilestoneId === null || typeof body.projectMilestoneId === "string";
  if (!hasDone && !hasDate && !hasCategory && !hasTime && !hasMilestone) {
    return NextResponse.json({ error: "no supported fields in body" }, { status: 400 });
  }

  // Each present field gets its own UPDATE rather than one combined
  // statement — simpler to reason about than juggling per-field types in a
  // single dynamic query, and correctness matters more than round-trips
  // here. This replaces the old if/else-if chain, whose early returns meant
  // e.g. {date, time} sent together would silently apply only date.
  const [existing] = hasDone ? await sql`SELECT done FROM tasks WHERE id = ${id}` : [undefined];
  if (hasDone) await sql`UPDATE tasks SET done = ${body.done} WHERE id = ${id}`;
  if (hasDate) {
    if (body.incrementPush) {
      await sql`UPDATE tasks SET date = ${body.date}, push_count = push_count + 1 WHERE id = ${id}`;
    } else {
      await sql`UPDATE tasks SET date = ${body.date} WHERE id = ${id}`;
    }
  }
  if (hasCategory) await sql`UPDATE tasks SET category = ${body.category} WHERE id = ${id}`;
  if (hasTime) await sql`UPDATE tasks SET time = ${body.time} WHERE id = ${id}`;
  if (hasMilestone) await sql`UPDATE tasks SET project_milestone_id = ${body.projectMilestoneId} WHERE id = ${id}`;

  const rows = await sql`SELECT * FROM tasks WHERE id = ${id}`;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (hasDone && body.done && !existing?.done) {
    await logCompletion(rows[0].title as string);
    if (rows[0].project_milestone_id) await checkMilestoneAutoComplete(rows[0].project_milestone_id as string);
  }
  // A task can arrive at a milestone already done (e.g. reassigning a
  // completed task), so re-check whether that just completes the milestone.
  if (hasMilestone && body.projectMilestoneId && rows[0].done) {
    await checkMilestoneAutoComplete(body.projectMilestoneId as string);
  }
  return NextResponse.json(rowToTask(rows[0]));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
