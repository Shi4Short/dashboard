import { NextResponse } from "next/server";
import { syncEvidenceFromNotion } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncEvidenceFromNotion();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
