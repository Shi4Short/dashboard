import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToSub, sql } from "@/lib/db";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { name, amount, renewDate } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO subs (id, name, amount, renew_date)
    VALUES (${id}, ${name.trim()}, ${Number(amount) || 0}, ${renewDate || ""})
    RETURNING *`;
  return NextResponse.json(rowToSub(rows[0]));
}
