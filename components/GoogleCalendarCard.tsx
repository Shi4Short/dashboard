"use client";

import { useEffect, useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";

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

export function GoogleCalendarCard({ actions }: { actions: ManifestActions }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

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

  const handleSync = async () => {
    setSyncStatus("syncing");
    try {
      const result = await actions.syncGoogleCalendar();
      setSyncStatus("done");
      setSyncMessage(
        `${result.synced} event${result.synced === 1 ? "" : "s"} synced to Today/Week/Month` +
          (result.skipped ? ` (${result.skipped} skipped)` : "")
      );
    } catch (e) {
      setSyncStatus("error");
      setSyncMessage(e instanceof Error ? e.message : String(e));
    }
  };

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
      ) : (
        <>
          {events.length ? (
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
            <button className="ghost" onClick={handleSync} disabled={syncStatus === "syncing"}>
              {syncStatus === "syncing" ? "Syncing…" : "Sync to Today/Week/Month"}
            </button>
            {syncMessage ? (
              <span
                style={{ fontSize: "11.5px", color: syncStatus === "error" ? "var(--danger)" : "var(--muted)" }}
              >
                {syncMessage}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
