import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, logCompletion, rowToProject, sql } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const { status } = await request.json();
  const [existing] = await sql`SELECT status FROM projects WHERE id = ${id}`;
  const rows = await sql`UPDATE projects SET status = ${status} WHERE id = ${id} RETURNING *`;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (status === "done" && existing?.status !== "done") await logCompletion(`Completed: ${rows[0].name}`);
  return NextResponse.json(rowToProject(rows[0]));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM projects WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
