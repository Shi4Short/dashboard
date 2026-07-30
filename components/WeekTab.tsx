"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import type { AppState } from "@/lib/types";
import { fmtDate, weekDaysFor } from "@/lib/utils";
import { AddWeekGoalRow, WeekGoalsList, WeekSquares } from "./shared";

export function WeekTab({ state, actions }: { state: AppState; actions: ManifestActions }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const days = weekDaysFor(weekOffset);
  const weekStart = days[0];
  const rangeLabel = `${fmtDate(days[0])} – ${fmtDate(days[6])}`;

  return (
    <>
      <div className="card">
        <div className="navrow">
          <button className="ghost" onClick={() => setWeekOffset((o) => o - 1)}>
            ‹ Prev week
          </button>
          <div className="qmonth-title" style={{ margin: 0 }}>
            {rangeLabel}
          </div>
          <button className="ghost" onClick={() => setWeekOffset((o) => o + 1)}>
            Next week ›
          </button>
        </div>
        {weekOffset !== 0 ? (
          <button className="ghost" style={{ marginBottom: "12px" }} onClick={() => setWeekOffset(0)}>
            Jump to this week
          </button>
        ) : null}
        <WeekSquares key={weekStart} days={days} compact={false} state={state} actions={actions} />
      </div>
      <div className="card">
        <h2>This Week&apos;s Goals</h2>
        <WeekGoalsList weekStart={weekStart} state={state} actions={actions} />
        <AddWeekGoalRow weekStart={weekStart} actions={actions} />
      </div>
    </>
  );
}
