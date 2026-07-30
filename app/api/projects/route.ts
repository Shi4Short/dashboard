import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToProject, sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { name, type } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO projects (id, name, type, status, notes)
    VALUES (${id}, ${name.trim()}, ${type}, 'active', '')
    RETURNING *`;
  return NextResponse.json(rowToProject(rows[0]));
}
