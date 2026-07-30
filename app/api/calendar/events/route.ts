import { NextResponse } from "next/server";
import { fetchUpcomingEvents, isCalendarConnected } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isCalendarConnected())) {
    return NextResponse.json({ connected: false, events: [] });
  }
  try {
    const events = await fetchUpcomingEvents();
    return NextResponse.json({ connected: true, events });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
