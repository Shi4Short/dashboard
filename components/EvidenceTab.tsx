"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import type { AppState } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

export function EvidenceTab({
  state,
  actions,
  onBackToToday,
}: {
  state: AppState;
  actions: ManifestActions;
  onBackToToday: () => void;
}) {
  const [manualInput, setManualInput] = useState("");

  return (
    <>
      <a
        href="#"
        style={{ color: "var(--muted)", fontSize: "12px" }}
        onClick={(e) => {
          e.preventDefault();
          onBackToToday();
        }}
      >
        ← Back to Today
      </a>
      <div className="datebar" style={{ marginTop: "14px" }}>
        Record
      </div>
      <h1>Evidence</h1>
      <div className="card">
        <h2>Add an entry manually</h2>
        <textarea placeholder="Log anything..." value={manualInput} onChange={(e) => setManualInput(e.target.value)} />
        <button
          className="primary"
          onClick={() => {
            actions.addLog(manualInput);
            setManualInput("");
          }}
        >
          Add entry
        </button>
      </div>
      <div className="card">
        <h2>History</h2>
        {state.log.length ? (
          state.log.map((l) => (
            <div className="logentry" key={l.id}>
              <div className="logdate">
                {fmtDate(l.date)}{" "}
                <button className="smallx" style={{ float: "right" }} onClick={() => actions.deleteLog(l.id)}>
                  ×
                </button>
              </div>
              <div style={{ whiteSpace: "pre-line" }}>{l.text}</div>
            </div>
          ))
        ) : (
          <div className="empty">No entries yet.</div>
        )}
      </div>
    </>
  );
}
