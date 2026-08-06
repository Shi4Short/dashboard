import { NextResponse } from "next/server";
import { reconcileEvidenceDates } from "@/lib/db";

export const dynamic = "force-dynamic";

// One-time cleanup for Evidence entries logged before task completions were
// dated to the task's own day instead of the day the checkbox was clicked
// (see logCompletion in lib/db.ts). Safe to call more than once — it's a
// no-op on entries that already match their task's date.
export async function POST() {
  const result = await reconcileEvidenceDates();
  return NextResponse.json(result);
}

// GET too, purely so this can be triggered by visiting the URL directly in
// a browser rather than needing a POST client.
export async function GET() {
  const result = await reconcileEvidenceDates();
  return NextResponse.json(result);
}
