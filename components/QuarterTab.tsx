"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import { CATEGORIES, CATEGORY_LABEL, type AppState } from "@/lib/types";
import { money } from "@/lib/utils";

const DEFAULT_GOALS =
  "$5,000 through design leads\nUGC deals (leaning into Canvas UGC over one-off deals)\nSev content running as passive income";

export function QuarterTab({ state, actions }: { state: AppState; actions: ManifestActions }) {
  // ManifestApp only mounts tabs after the initial /api/state fetch resolves,
  // so state.q3goals already holds the loaded value on first render here.
  const [goalsDraft, setGoalsDraft] = useState(state.q3goals || DEFAULT_GOALS);

  const now = new Date();
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const year = now.getFullYear();

  const monthCards = [0, 1, 2].map((offset) => {
    const m = qStartMonth + offset;
    const monthName = new Date(year, m, 1).toLocaleDateString("en-US", { month: "long" });
    const monthTasks = state.tasks.filter((t) => {
      const [ty, tm] = t.date.split("-").map(Number);
      return ty === year && tm - 1 === m;
    });
    const done = monthTasks.filter((t) => t.done).length;
    const byCat = CATEGORIES.map((c) => ({ c, n: monthTasks.filter((t) => t.category === c).length })).filter(
      (x) => x.n
    );
    const dealsInMonth = state.deals.filter((d) => {
      const [dy, dm] = d.date.split("-").map(Number);
      return dy === year && dm - 1 === m;
    });
    const finInMonth = state.financeEntries.filter((e) => {
      const [fy, fm] = e.date.split("-").map(Number);
      return fy === year && fm - 1 === m;
    });
    const inSum = finInMonth.filter((e) => e.type === "in").reduce((a, e) => a + e.amount, 0);
    const outSum = finInMonth.filter((e) => e.type === "out").reduce((a, e) => a + e.amount, 0);

    return (
      <div className="card" key={m}>
        <div className="qmonth-title">
          {monthName} {year}
        </div>
        <div className="statrow">
          <span>Tasks logged</span>
          <span className="n">{monthTasks.length}</span>
        </div>
        <div className="statrow">
          <span>Completed</span>
          <span className="n">{done}</span>
        </div>
        {byCat.map((x) => (
          <div className="statrow" key={x.c}>
            <span>{CATEGORY_LABEL[x.c]}</span>
            <span className="n">{x.n}</span>
          </div>
        ))}
        <div className="statrow">
          <span>UGC deals added</span>
          <span className="n">{dealsInMonth.length}</span>
        </div>
        <div className="statrow">
          <span>Income logged</span>
          <span className="n">{money(inSum)}</span>
        </div>
        <div className="statrow">
          <span>Expenses logged</span>
          <span className="n">{money(outSum)}</span>
        </div>
      </div>
    );
  });

  return (
    <>
      <div className="datebar">
        Q{Math.floor(qStartMonth / 3) + 1} {year}
      </div>
      <h1>Quarter</h1>
      <div className="card">
        <h2>Q3 Goals</h2>
        <textarea
          style={{ minHeight: "110px" }}
          value={goalsDraft}
          onChange={(e) => setGoalsDraft(e.target.value)}
        />
        <button className="primary" onClick={() => actions.saveQ3Goals(goalsDraft)}>
          Save
        </button>
      </div>
      <div className="grid3">{monthCards}</div>
    </>
  );
}
