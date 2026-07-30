"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import { STAGES, type AppState } from "@/lib/types";
import { fmtDate, money, todayStr, weekDaysFor } from "@/lib/utils";
import { AddWeekGoalRow, WeekGoalsList, WeekSquares } from "./shared";
import { NotionNetworkingCard } from "./NotionNetworkingCard";

export function DashboardTab({ state, actions }: { state: AppState; actions: ManifestActions }) {
  const [ui, setUi] = useState({ portfolioExpanded: false, weavyExpanded: false, webflowExpanded: false });
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subRenew, setSubRenew] = useState("");
  const [dealBrand, setDealBrand] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealStage, setDealStage] = useState<(typeof STAGES)[number]>("outbound");
  const [portfolioInput, setPortfolioInput] = useState("");
  const [weavyInput, setWeavyInput] = useState("");
  const [webflowInput, setWebflowInput] = useState("");

  const t0 = todayStr();
  const subTotal = state.subs.reduce((a, s) => a + s.amount, 0);
  const q3Sum = state.deals
    .filter((d) => d.stage === "booked" && d.date >= "2026-07-01" && d.date <= "2026-09-30")
    .reduce((a, d) => a + (d.value || 0), 0);
  const q3Pct = Math.min(100, Math.round((q3Sum / 5000) * 100));

  const portfolioTasks = state.projects.filter((p) => p.type === "portfolio");
  const portfolioDone = portfolioTasks.filter((p) => p.status === "done").length;
  const portfolioPct = portfolioTasks.length ? Math.round((portfolioDone / portfolioTasks.length) * 100) : 0;

  const dealDates = [...new Set(state.deals.map((d) => d.date))].sort().reverse();
  const dashWeekDays = weekDaysFor(0);
  const dashWeekStart = dashWeekDays[0];

  return (
    <>
      <div className="datebar">{fmtDate(t0)}</div>
      <h1>Dashboard</h1>

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

      <div className="grid3">
        <div className="card">
          <h2>Portfolio</h2>
          <div className="proglabel">
            <span>
              {portfolioDone}/{portfolioTasks.length} complete
            </span>
            <span>{portfolioPct}%</span>
          </div>
          <div className="progbar" onClick={() => setUi((u) => ({ ...u, portfolioExpanded: !u.portfolioExpanded }))}>
            <div className="progfill" style={{ width: `${portfolioPct}%` }} />
          </div>
          {ui.portfolioExpanded ? (
            <div className="milestonelist">
              {portfolioTasks.length ? (
                portfolioTasks.map((p) => (
                  <div className="miniitem" key={p.id}>
                    <span className="name">{p.name}</span>
                    <select value={p.status} onChange={(e) => actions.updateProjectStatus(p.id, e.target.value)}>
                      {["active", "waiting", "done"].map((s) => (
                        <option value={s} key={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button className="smallx" onClick={() => actions.deleteProject(p.id)}>
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">No portfolio tasks yet.</div>
              )}
              <div className="addrow">
                <input
                  type="text"
                  placeholder="Portfolio task..."
                  value={portfolioInput}
                  onChange={(e) => setPortfolioInput(e.target.value)}
                />
                <button
                  className="primary"
                  onClick={() => {
                    actions.addProject(portfolioInput, "portfolio");
                    setPortfolioInput("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="checkin-q" style={{ margin: "14px 0 8px" }}>
                Outreach targets
              </div>
              <ExternalLink href="https://linkedin.com/in/jessica-svendsen-266a0b136">Jessica Svendsen (LinkedIn)</ExternalLink>
              <ExternalLink href="https://tinasmith.com">Tina Smith (Portfolio)</ExternalLink>
              <ExternalLink href="https://diegogallego.es">Diego Gallego (Portfolio)</ExternalLink>
              <ExternalLink href="https://adplist.org/explore">ADPList Explore</ExternalLink>
              <div className="checkin-q" style={{ margin: "10px 0 8px" }}>
                Study list
              </div>
              <ExternalLink href="https://www.youtube.com/watch?v=YLo6g58vUm0">Intro to Design Systems (YouTube)</ExternalLink>
              <ExternalLink href="https://www.youtube.com/watch?v=Jjt-ZXY4eRY">100 Art Direction Ideas (YouTube)</ExternalLink>
              <ExternalLink href="https://www.youtube.com/watch?v=7uV_V07p7L8">
                Where Do Strategic Insights Come From? (market gap)
              </ExternalLink>
              <ExternalLink href="https://www.instagram.com/p/DHWhOdgRN3-/">Brand/system logic (IG)</ExternalLink>
              <ExternalLink href="https://www.instagram.com/p/DGyLPiBR7m7/">Visual inspiration (IG)</ExternalLink>
              <div className="checkin-q" style={{ margin: "10px 0 8px" }}>
                Vault / Inspo
              </div>
              <ExternalLink href="https://www.figma.com/board/TDrBogrS8XreRY3QgGSGES/How-to-become-an-Art-Director?node-id=4-621">
                How to Become an Art Director (Figma board)
              </ExternalLink>
              <ExternalLink href="https://www.elirothas.com/crayola">Crayola project (inspo)</ExternalLink>
            </div>
          ) : null}
        </div>

        <MilestoneCard
          title="Weavy"
          track="weavy"
          colorClass="sage"
          state={state}
          actions={actions}
          expanded={ui.weavyExpanded}
          onToggle={() => setUi((u) => ({ ...u, weavyExpanded: !u.weavyExpanded }))}
          input={weavyInput}
          setInput={setWeavyInput}
        />
        <MilestoneCard
          title="Webflow"
          track="webflow"
          colorClass="teal"
          state={state}
          actions={actions}
          expanded={ui.webflowExpanded}
          onToggle={() => setUi((u) => ({ ...u, webflowExpanded: !u.webflowExpanded }))}
          input={webflowInput}
          setInput={setWebflowInput}
        />
      </div>
    </>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="miniitem">
      <span className="name">
        <a href={href} target="_blank" rel="noopener noreferrer" className="linklike">
          {children}
        </a>
      </span>
    </div>
  );
}

function MilestoneCard({
  title,
  track,
  colorClass,
  state,
  actions,
  expanded,
  onToggle,
  input,
  setInput,
}: {
  title: string;
  track: "weavy" | "webflow";
  colorClass: "sage" | "teal";
  state: AppState;
  actions: ManifestActions;
  expanded: boolean;
  onToggle: () => void;
  input: string;
  setInput: (v: string) => void;
}) {
  const items = state.milestones[track];
  const done = items.filter((m) => m.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="proglabel">
        <span>
          {done}/{items.length} milestones
        </span>
        <span>{pct}%</span>
      </div>
      <div className="progbar" onClick={onToggle}>
        <div className={`progfill ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      {expanded ? (
        <div className="milestonelist">
          {items.length ? (
            items.map((m) => (
              <div className={`taskrow ${m.done ? "done" : ""}`} key={m.id}>
                <input type="checkbox" checked={m.done} onChange={() => actions.toggleMilestone(track, m.id)} />
                <span className="title">{m.title}</span>
                <button className="smallx" onClick={() => actions.deleteMilestone(track, m.id)}>
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="empty">No milestones yet.</div>
          )}
          <div className="addrow">
            <input type="text" placeholder="Milestone or checkpoint..." value={input} onChange={(e) => setInput(e.target.value)} />
            <button
              className="primary"
              onClick={() => {
                actions.addMilestone(track, input);
                setInput("");
              }}
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
