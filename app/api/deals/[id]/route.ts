import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToDeal, sql } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const { stage } = await request.json();
  const rows = await sql`UPDATE deals SET stage = ${stage} WHERE id = ${id} RETURNING *`;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(rowToDeal(rows[0]));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM deals WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
