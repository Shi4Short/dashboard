import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, rowToLogEntry, sql } from "@/lib/db";
import { pushEvidenceEntry } from "@/lib/notion";
import { todayStr } from "@/lib/utils";

export async function POST(request: NextRequest) {
  await ensureSchema();
  const { text } = await request.json();
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const id = randomUUID();
  const date = todayStr();
  const trimmed = text.trim();
  const rows = await sql`
    INSERT INTO log_entries (id, date, text)
    VALUES (${id}, ${date}, ${trimmed})
    RETURNING *`;

  // Same best-effort auto-push as logCompletion — a Notion hiccup shouldn't
  // block saving the entry locally.
  try {
    const pageId = await pushEvidenceEntry(trimmed, date);
    await sql`UPDATE log_entries SET notion_page_id = ${pageId} WHERE id = ${id}`;
    rows[0].notion_page_id = pageId;
  } catch {
    // ignore
  }

  return NextResponse.json(rowToLogEntry(rows[0]));
}
