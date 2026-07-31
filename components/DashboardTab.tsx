"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import { STAGES, type AppState } from "@/lib/types";
import { fmtDate, money, todayStr, weekDaysFor } from "@/lib/utils";
import { AddWeekGoalRow, ProjectProgressBar, WeekGoalsList, WeekSquares } from "./shared";
import { NotionNetworkingCard } from "./NotionNetworkingCard";
import { NotionSyncButton } from "./NotionSyncButton";
import { GoogleCalendarCard } from "./GoogleCalendarCard";

export function DashboardTab({ state, actions }: { state: AppState; actions: ManifestActions }) {
  const router = useRouter();
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subRenew, setSubRenew] = useState("");
  const [dealBrand, setDealBrand] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealStage, setDealStage] = useState<(typeof STAGES)[number]>("outbound");

  const t0 = todayStr();
  const subTotal = state.subs.reduce((a, s) => a + s.amount, 0);
  const q3Sum = state.deals
    .filter((d) => d.stage === "booked" && d.date >= "2026-07-01" && d.date <= "2026-09-30")
    .reduce((a, d) => a + (d.value || 0), 0);
  const q3Pct = Math.min(100, Math.round((q3Sum / 5000) * 100));

  const dealDates = [...new Set(state.deals.map((d) => d.date))].sort().reverse();
  const dashWeekDays = weekDaysFor(0);
  const dashWeekStart = dashWeekDays[0];

  return (
    <>
      <div className="datebar">{fmtDate(t0)}</div>
      <h1>Dashboard</h1>
      <NotionSyncButton actions={actions} />

      <h2
        style={{
          fontFamily: "var(--font-fraunces), serif",
          fontWeight: 500,
          color: "var(--gold)",
          fontSize: "15px",
          margin: "0 0 4px",
        }}
      >
        Projects
      </h2>
      {state.projects.map((p) => {
        const projectMilestones = state.projectMilestones.filter((m) => m.projectId === p.id);
        const done = projectMilestones.filter((m) => m.done).length;
        const pct = projectMilestones.length ? Math.round((done / projectMilestones.length) * 100) : 0;
        return (
          <div
            className="card"
            style={{ cursor: "pointer" }}
            key={p.id}
            onClick={() => router.push(`/projects/${p.id}`)}
          >
            <h2>
              {p.name}{" "}
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>{p.type}</span>
            </h2>
            <div className="proglabel">
              <span>
                {done}/{projectMilestones.length} milestones
              </span>
              <span>{pct}%</span>
            </div>
            {projectMilestones.length ? (
              <ProjectProgressBar milestones={projectMilestones} tasks={state.tasks} />
            ) : (
              <div className="empty">No milestones yet — click in to add some.</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginTop: "8px" }}>
              <select
                value={p.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => actions.updateProjectStatus(p.id, e.target.value)}
              >
                {["active", "waiting", "done"].map((s) => (
                  <option value={s} key={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                className="smallx"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.deleteProject(p.id);
                }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      <div className="card">
        <h2>
          Week at a Glance{" "}
          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>
            {fmtDate(dashWeekDays[0])} – {fmtDate(dashWeekDays[6])}
          </span>
        </h2>
        <WeekSquares days={dashWeekDays} compact state={state} actions={actions} />
        <div className="milestonelist">
          <WeekGoalsList weekStart={dashWeekStart} state={state} actions={actions} />
          <AddWeekGoalRow weekStart={dashWeekStart} actions={actions} />
        </div>
      </div>

      <GoogleCalendarCard actions={actions} />

      <div className="card">
        <h2>Q3 Goal: $5,000</h2>
        <div className="proglabel">
          <span>{money(q3Sum)} booked</span>
          <span>{q3Pct}%</span>
        </div>
        <div className="progbar">
          <div className="progfill" style={{ width: `${q3Pct}%` }} />
        </div>
        <div className="checkin-q" style={{ marginTop: "10px" }}>
          Based on the Chime pitch ($800): at that deal size, ~7 deals closes this out. At a $500 average, ~10 deals.
          Assuming roughly 1-in-6 pitches closes (a placeholder assumption until you have real data), that&apos;s
          40-60 pitches across the ~10 weeks left — under 1/day, well inside the 5/day pace already in your plan. The
          real lever isn&apos;t pitch volume, it&apos;s whether design leads (bigger ticket) land — 2-3 of those
          alone could cover most of it.
        </div>
        <div className="checkin-q" style={{ marginTop: "6px" }}>
          This bar only counts deals marked &quot;booked&quot; below — pitched/negotiating deals show progress
          toward the goal, not the goal itself.
        </div>
      </div>

      <div className="card">
        <h2>
          Subscriptions <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>{money(subTotal)}/mo</span>
        </h2>
        {state.subs.length ? (
          state.subs.map((s) => (
            <div className="finrow" key={s.id}>
              <span>
                {s.name} <span style={{ color: "var(--muted)", fontSize: "11px" }}>renews {s.renewDate || "—"}</span>
              </span>
              <span className="amt out">
                {money(s.amount)}
                <button className="smallx" onClick={() => actions.deleteSub(s.id)}>
                  ×
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className="empty">No subscriptions tracked.</div>
        )}
        <div className="addrow">
          <input
            type="text"
            placeholder="Subscription name"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
          />
          <input
            type="number"
            placeholder="$/mo"
            value={subAmount}
            onChange={(e) => setSubAmount(e.target.value)}
          />
          <input type="date" value={subRenew} onChange={(e) => setSubRenew(e.target.value)} />
          <button
            className="primary"
            onClick={() => {
              actions.addSub(subName, subAmount, subRenew);
              setSubName("");
              setSubAmount("");
              setSubRenew("");
            }}
          >
            Add sub
          </button>
        </div>
      </div>

      <div className="card">
        <h2>
          Pitches <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>{state.pitchLog[t0] || 0} sent today</span>
        </h2>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <button className="primary" onClick={() => actions.bumpPitch(1)}>
            +1 sent today
          </button>
          <button className="ghost" onClick={() => actions.bumpPitch(-1)}>
            −1
          </button>
        </div>
        {dealDates.length ? (
          dealDates.map((date) => (
            <div style={{ marginBottom: "12px" }} key={date}>
              <div className="listitem-meta" style={{ marginBottom: "6px" }}>
                {fmtDate(date)}
                {date === t0 ? " · TODAY" : ""} — {state.pitchLog[date] || 0} pitch{(state.pitchLog[date] || 0) === 1 ? "" : "es"}
              </div>
              {state.deals
                .filter((d) => d.date === date)
                .map((d) => (
                  <div className="miniitem" key={d.id}>
                    <span className="name">
                      {d.brand}
                      {d.value ? ` — ${money(d.value)}` : ""}
                    </span>
                    <select value={d.stage} onChange={(e) => actions.updateDealStage(d.id, e.target.value as (typeof STAGES)[number])}>
                      {STAGES.map((s) => (
                        <option value={s} key={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button className="smallx" onClick={() => actions.deleteDeal(d.id)}>
                      ×
                    </button>
                  </div>
                ))}
            </div>
          ))
        ) : (
          <div className="empty">No pitches logged yet.</div>
        )}
        <div className="addrow">
          <input type="text" placeholder="Brand name..." value={dealBrand} onChange={(e) => setDealBrand(e.target.value)} />
          <input type="number" placeholder="$ value" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
          <select value={dealStage} onChange={(e) => setDealStage(e.target.value as (typeof STAGES)[number])}>
            {STAGES.map((s) => (
              <option value={s} key={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            className="primary"
            onClick={() => {
              actions.addDeal(dealBrand, dealStage, dealValue);
              setDealBrand("");
              setDealValue("");
            }}
          >
            Add pitch
          </button>
        </div>
      </div>

      <NotionNetworkingCard />
    </>
  );
}
