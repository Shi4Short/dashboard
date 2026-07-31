import { NextResponse } from "next/server";
import { syncGoogleCalendarEvents } from "@/lib/db";
import { fetchUpcomingEvents, isCalendarConnected } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!(await isCalendarConnected())) {
      return NextResponse.json({ error: "Google Calendar is not connected yet" }, { status: 400 });
    }
    const events = await fetchUpcomingEvents();
    const result = await syncGoogleCalendarEvents(events);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
