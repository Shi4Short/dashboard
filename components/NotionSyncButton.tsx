"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";

export function NotionSyncButton({ actions }: { actions: ManifestActions }) {
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSync = async () => {
    setStatus("syncing");
    try {
      const result = await actions.syncFromNotion();
      setStatus("done");
      setMessage(
        `Synced ${result.tasksSynced} task${result.tasksSynced === 1 ? "" : "s"}, ${result.goalsSynced} goal${
          result.goalsSynced === 1 ? "" : "s"
        }${result.skipped ? ` (${result.skipped} skipped — no date)` : ""}`
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
      <button className="ghost" onClick={handleSync} disabled={status === "syncing"}>
        {status === "syncing" ? "Syncing…" : "Sync from Notion"}
      </button>
      {message ? (
        <span style={{ fontSize: "11.5px", color: status === "error" ? "var(--danger)" : "var(--muted)" }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
