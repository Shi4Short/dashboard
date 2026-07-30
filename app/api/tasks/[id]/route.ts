import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToTask, sql } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const body = await request.json();

  if (typeof body.done === "boolean") {
    const rows = await sql`UPDATE tasks SET done = ${body.done} WHERE id = ${id} RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(rowToTask(rows[0]));
  }
  if (typeof body.date === "string") {
    const rows = body.incrementPush
      ? await sql`UPDATE tasks SET date = ${body.date}, push_count = push_count + 1 WHERE id = ${id} RETURNING *`
      : await sql`UPDATE tasks SET date = ${body.date} WHERE id = ${id} RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(rowToTask(rows[0]));
  }
  return NextResponse.json({ error: "no supported fields in body" }, { status: 400 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
