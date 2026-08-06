"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import { CATEGORIES, CATEGORY_LABEL, type AppState, type Category } from "@/lib/types";
import { addDays, fmtDate, todayStr } from "@/lib/utils";
import { TaskRow, Timeline } from "./shared";

export function TodayTab({
  state,
  actions,
  onViewEvidence,
}: {
  state: AppState;
  actions: ManifestActions;
  onViewEvidence: () => void;
}) {
  const [todayViewDate, setTodayViewDate] = useState(todayStr());
  const [taskInput, setTaskInput] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskCat, setTaskCat] = useState<Category>("content");
  const [eodInput, setEodInput] = useState("");

  const t0 = todayStr();
  const isActualToday = todayViewDate === t0;
  const dayTasks = state.tasks.filter((t) => t.date === todayViewDate);
  const grouped = CATEGORIES.map((c) => ({ cat: c, items: dayTasks.filter((t) => t.category === c) })).filter(
    (g) => g.items.length
  );

  // Each task/goal/milestone already logs itself to Evidence the moment it's
  // checked off (see useManifestState's logCompletion), so this only needs to
  // cover what that doesn't: pitch count and the freeform note. Re-bundling
  // done tasks here too would just duplicate their individual entries.
  const submitEOD = () => {
    const bullets: string[] = [];
    const pitchCount = state.pitchLog[t0] || 0;
    if (pitchCount > 0) bullets.push(`${pitchCount} pitch${pitchCount > 1 ? "es" : ""} sent`);
    if (eodInput.trim()) bullets.push(eodInput.trim());
    if (bullets.length) {
      actions.addLog(bullets.map((b) => "• " + b).join("\n"));
    }
    setEodInput("");
    onViewEvidence();
  };

  return (
    <>
      <div className="navrow" style={{ marginBottom: "6px" }}>
        <button className="ghost" onClick={() => setTodayViewDate(addDays(todayViewDate, -1))}>
          ‹ Prev day
        </button>
        <div className="datebar" style={{ marginBottom: 0 }}>
          {fmtDate(todayViewDate)}
          {isActualToday ? " · TODAY" : ""}
        </div>
        <button className="ghost" onClick={() => setTodayViewDate(addDays(todayViewDate, 1))}>
          Next day ›
        </button>
      </div>
      <h1>{isActualToday ? "Today" : fmtDate(todayViewDate)}</h1>
      {!isActualToday ? (
        <button className="ghost" style={{ marginBottom: "16px" }} onClick={() => setTodayViewDate(todayStr())}>
          Jump back to today
        </button>
      ) : null}

      <div className="card">
        <h2>Mapped to the day</h2>
        <Timeline dayTasks={dayTasks} />
      </div>

      <div className="today-grid">
        <div>
          <div className="card">
            <h2>{isActualToday ? "Today's tasks" : "Tasks for this day"}</h2>
            {grouped.length ? (
              grouped.map((g) => (
                <div style={{ marginBottom: "10px" }} key={g.cat}>
                  {g.items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      showPush
                      onToggle={actions.toggleTask}
                      onDelete={actions.deleteTask}
                      onPushTomorrow={actions.pushTaskToTomorrow}
                      onCategoryChange={actions.updateTaskCategory}
                    />
                  ))}
                </div>
              ))
            ) : (
              <div className="empty">Nothing scheduled yet.</div>
            )}
            <div className="addrow">
              <input type="text" placeholder="Add a task..." value={taskInput} onChange={(e) => setTaskInput(e.target.value)} />
              <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
              <select value={taskCat} onChange={(e) => setTaskCat(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option value={c} key={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <button
                className="primary"
                onClick={() => {
                  actions.addTask(taskInput, taskCat, todayViewDate, taskTime);
                  setTaskInput("");
                  setTaskTime("");
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div className="card">
            <h2>Evidence for this day</h2>
            {(() => {
              const dayLogs = state.log.filter((l) => l.date === todayViewDate);
              return dayLogs.length ? (
                dayLogs.map((l) => (
                  <div className="logentry" key={l.id}>
                    <div style={{ whiteSpace: "pre-line" }}>{l.text}</div>
                  </div>
                ))
              ) : (
                <div className="empty">Nothing logged for this day yet.</div>
              );
            })()}
          </div>
          {isActualToday ? (
            <div className="card">
              <h2>End of day</h2>
              <div className="checkin-q">What actually got done today:</div>
              {(() => {
                const doneToday = state.tasks.filter((t) => t.date === t0 && t.done).map((t) => t.title);
                const pc = state.pitchLog[t0] || 0;
                const bullets = [...doneToday];
                if (pc > 0) bullets.push(`${pc} pitch${pc > 1 ? "es" : ""} sent`);
                return bullets.length ? (
                  <div className="milestonelist" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                    {bullets.map((b, i) => (
                      <div style={{ fontSize: "13px", padding: "4px 0" }} key={i}>
                        • {b}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">Nothing checked off yet — check tasks off above as you go.</div>
                );
              })()}
              <div className="checkin-q" style={{ marginTop: "12px" }}>
                Anything else to add before this gets logged:
              </div>
              <textarea
                placeholder="Optional — anything the checklist doesn't capture..."
                value={eodInput}
                onChange={(e) => setEodInput(e.target.value)}
              />
              <button className="primary" onClick={submitEOD}>
                Add evidence
              </button>
              <div style={{ marginTop: "10px" }}>
                <a
                  href="#"
                  style={{ color: "var(--muted)", fontSize: "12px" }}
                  onClick={(e) => {
                    e.preventDefault();
                    onViewEvidence();
                  }}
                >
                  View all evidence logs →
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
