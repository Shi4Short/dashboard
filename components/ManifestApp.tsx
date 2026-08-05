"use client";

import { useState } from "react";
import { useManifestState } from "@/lib/useManifestState";
import { DashboardTab } from "./DashboardTab";
import { TodayTab } from "./TodayTab";
import { WeekTab } from "./WeekTab";
import { MonthTab } from "./MonthTab";
import { QuarterTab } from "./QuarterTab";
import { EvidenceTab } from "./EvidenceTab";

type Tab = "dashboard" | "today" | "week" | "month" | "quarter" | "evidence";

export function ManifestApp() {
  const { state, loaded, error, actionError, clearActionError, actions } = useManifestState();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  if (!loaded) {
    return <div className="loadmsg">Loading manifest…</div>;
  }

  if (error) {
    return (
      <div className="loadmsg">
        Couldn&apos;t load the manifest — the database isn&apos;t reachable ({error}). If you&apos;re running
        locally, make sure POSTGRES_URL and friends are set in .env.local (see README.md).
      </div>
    );
  }

  return (
    <div className="main">
      {actionError ? (
        <div
          style={{
            background: "rgba(181,101,74,.15)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <span>{actionError}</span>
          <button className="ghost" style={{ flexShrink: 0 }} onClick={clearActionError}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="topbar">
        <div className="brand">
          747
          <small>Daily Manifest</small>
        </div>
        <div className="tabbar">
          {(
            [
              ["dashboard", "Dashboard"],
              ["today", "Today"],
              ["week", "Week"],
              ["month", "Month"],
              ["quarter", "Quarter"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={`tabbtn ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "dashboard" ? <DashboardTab state={state} actions={actions} /> : null}
      {activeTab === "today" ? (
        <TodayTab state={state} actions={actions} onViewEvidence={() => setActiveTab("evidence")} />
      ) : null}
      {activeTab === "week" ? <WeekTab state={state} actions={actions} /> : null}
      {activeTab === "month" ? <MonthTab state={state} actions={actions} /> : null}
      {activeTab === "quarter" ? <QuarterTab state={state} actions={actions} /> : null}
      {activeTab === "evidence" ? (
        <EvidenceTab state={state} actions={actions} onBackToToday={() => setActiveTab("today")} />
      ) : null}
    </div>
  );
}
