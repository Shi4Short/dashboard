import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToTask, sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const body = await request.json();
  const { title, category, date, time = "", fromCalendar = false, goalId = null, projectMilestoneId = null } = body;
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO tasks (id, title, category, date, time, done, from_calendar, goal_id, project_milestone_id)
    VALUES (${id}, ${title.trim()}, ${category}, ${date}, ${time}, false, ${fromCalendar}, ${goalId}, ${projectMilestoneId})
    RETURNING *`;
  return NextResponse.json(rowToTask(rows[0]));
}
