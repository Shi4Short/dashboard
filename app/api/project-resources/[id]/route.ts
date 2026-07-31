import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM project_resources WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
