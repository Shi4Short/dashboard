import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";

export async function PUT(request: NextRequest) {
  await ensureSchema();
  const { q3goals } = await request.json();
  await sql`
    INSERT INTO settings (key, value) VALUES ('q3goals', ${q3goals ?? ""})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return NextResponse.json({ ok: true });
}
