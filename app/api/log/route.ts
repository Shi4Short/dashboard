import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToLogEntry, sql } from "@/lib/db";
import { todayStr } from "@/lib/utils";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { text } = await request.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO log_entries (id, date, text)
    VALUES (${id}, ${todayStr()}, ${text.trim()})
    RETURNING *`;
  return NextResponse.json(rowToLogEntry(rows[0]));
}
