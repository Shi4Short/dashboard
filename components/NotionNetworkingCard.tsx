"use client";

import { useNotionNetworking } from "@/lib/useNotionNetworking";

export function NotionNetworkingCard() {
  const { contacts, loaded, error } = useNotionNetworking();

  return (
    <div className="card">
      <h2>
        Art Direction Networking{" "}
        <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>synced from Notion</span>
      </h2>
      {!loaded ? (
        <div className="empty">Loading…</div>
      ) : error ? (
        <div className="empty">Not connected — set NOTION_TOKEN to sync this database.</div>
      ) : contacts.length ? (
        contacts.map((c) => (
          <div className="miniitem" key={c.id}>
            <span className="name">
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="linklike">
                {c.name}
              </a>
              {c.notes ? <span style={{ color: "var(--muted)", fontSize: "11px" }}> — {c.notes}</span> : null}
            </span>
            {c.platform ? (
              <span className="tag" style={{ background: "rgba(201,161,90,.15)", color: "var(--gold)" }}>
                {c.platform}
              </span>
            ) : null}
            {c.status ? (
              <span className="tag" style={{ background: "rgba(138,160,123,.15)", color: "var(--sage)" }}>
                {c.status}
              </span>
            ) : null}
          </div>
        ))
      ) : (
        <div className="empty">No contacts logged yet.</div>
      )}
    </div>
  );
}
