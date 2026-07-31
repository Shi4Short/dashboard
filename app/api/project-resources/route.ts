import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToProjectResource, sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { projectId, label, url } = await request.json();
  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!url || typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO project_resources (id, project_id, label, url)
    VALUES (${id}, ${projectId}, ${label.trim()}, ${url.trim()})
    RETURNING *`;
  return NextResponse.json(rowToProjectResource(rows[0]));
}
