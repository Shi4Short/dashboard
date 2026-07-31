import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToProjectMilestone, sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { projectId, title } = await request.json();
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO project_milestones (id, project_id, title, done)
    VALUES (${id}, ${projectId}, ${title.trim()}, false)
    RETURNING *`;
  return NextResponse.json(rowToProjectMilestone(rows[0]));
}
