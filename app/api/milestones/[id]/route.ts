import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, logCompletion, rowToMilestone, sql } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const { done } = await request.json();
  const [existing] = await sql`SELECT done FROM milestones WHERE id = ${id}`;
  const rows = await sql`UPDATE milestones SET done = ${done} WHERE id = ${id} RETURNING *`;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (done && !existing?.done) {
    const trackLabel = rows[0].track === "weavy" ? "Weavy" : "Webflow";
    await logCompletion(`${trackLabel} milestone: ${rows[0].title}`);
  }
  return NextResponse.json(rowToMilestone(rows[0]));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  await sql`DELETE FROM milestones WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
