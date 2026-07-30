import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToDeal, sql } from "@/lib/db";
import { todayStr } from "@/lib/utils";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const body = await request.json();
  const { brand, stage, value = 0 } = body;
  if (!brand || typeof brand !== "string" || !brand.trim()) {
    return NextResponse.json({ error: "brand is required" }, { status: 400 });
  }
  const id = randomUUID();
  const date = todayStr();
  const rows = await sql`
    INSERT INTO deals (id, brand, stage, date, notes, value)
    VALUES (${id}, ${brand.trim()}, ${stage}, ${date}, '', ${Number(value) || 0})
    RETURNING *`;

  return NextResponse.json(rowToDeal(rows[0]));
}
