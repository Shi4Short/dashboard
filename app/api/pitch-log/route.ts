import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { todayStr } from "@/lib/utils";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { delta } = await request.json();
  const date = todayStr();
  const { rows } = await sql`
    INSERT INTO pitch_log (date, count) VALUES (${date}, GREATEST(0, ${delta}))
    ON CONFLICT (date) DO UPDATE SET count = GREATEST(0, pitch_log.count + ${delta})
    RETURNING *`;
  return NextResponse.json({ date, count: Number(rows[0].count) });
}
