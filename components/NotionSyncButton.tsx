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
      const parts = [
        `${result.tasksSynced} task${result.tasksSynced === 1 ? "" : "s"} pulled`,
        `${result.goalsSynced} goal${result.goalsSynced === 1 ? "" : "s"} pulled`,
      ];
      if (result.pushed) parts.push(`${result.pushed} completion${result.pushed === 1 ? "" : "s"} pushed to Notion`);
      if (result.skipped) parts.push(`${result.skipped} skipped — no date`);
      setMessage(parts.join(", "));
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
      <button className="ghost" onClick={handleSync} disabled={status === "syncing"}>
        {status === "syncing" ? "Syncing…" : "Sync with Notion"}
      </button>
      {message ? (
        <span style={{ fontSize: "11.5px", color: status === "error" ? "var(--danger)" : "var(--muted)" }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
