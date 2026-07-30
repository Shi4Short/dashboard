import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToMilestone } from "@/lib/db";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { track, title } = await request.json();
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (track !== "weavy" && track !== "webflow") {
    return NextResponse.json({ error: "invalid track" }, { status: 400 });
  }
  const id = randomUUID();
  const { rows } = await sql`
    INSERT INTO milestones (id, track, title, done)
    VALUES (${id}, ${track}, ${title.trim()}, false)
    RETURNING *`;
  return NextResponse.json(rowToMilestone(rows[0]));
}
