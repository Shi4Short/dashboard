"use client";

import { useEffect, useState } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  url: string | null;
}

function fmtEventTime(ev: CalendarEvent): string {
  if (!ev.start) return "";
  if (ev.allDay) {
    return new Date(ev.start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return new Date(ev.start).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GoogleCalendarCard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calendar/events")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setConnected(body.connected);
        setEvents(body.events);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="card">
      <h2>
        Calendar <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>Google Calendar</span>
      </h2>
      {connected === null && !error ? (
        <div className="empty">Loading…</div>
      ) : error ? (
        <div className="empty">{error}</div>
      ) : !connected ? (
        <>
          <div className="checkin-q">Not connected yet.</div>
          <button className="primary" onClick={() => (window.location.href = "/api/auth/google")}>
            Connect Google Calendar
          </button>
        </>
      ) : events.length ? (
        events.map((ev) => (
          <div className="miniitem" key={ev.id}>
            <span className="name">
              {ev.url ? (
                <a href={ev.url} target="_blank" rel="noopener noreferrer" className="linklike">
                  {ev.title}
                </a>
              ) : (
                ev.title
              )}
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>{fmtEventTime(ev)}</span>
          </div>
        ))
      ) : (
        <div className="empty">No upcoming events.</div>
      )}
    </div>
  );
}
