import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToWeekGoal } from "@/lib/db";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { text, weekStart } = await request.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (!weekStart || typeof weekStart !== "string") {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }
  const id = randomUUID();
  const { rows } = await sql`
    INSERT INTO week_goals (id, text, week_start, done)
    VALUES (${id}, ${text.trim()}, ${weekStart}, false)
    RETURNING *`;
  return NextResponse.json(rowToWeekGoal(rows[0]));
}
