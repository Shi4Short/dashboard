"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import { CATEGORIES, CATEGORY_LABEL, type AppState, type Category } from "@/lib/types";
import { dateStr, fmtDate, todayStr } from "@/lib/utils";
import { TaskRow, Timeline } from "./shared";

export function MonthTab({ state, actions }: { state: AppState; actions: ManifestActions }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [taskInput, setTaskInput] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskCat, setTaskCat] = useState<Category>("content");

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = base.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const t0 = todayStr();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div className="calcell empty2" key={`empty-${i}`} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(year, month, d);
    const dayTasks = state.tasks.filter((t) => t.date === ds);
    const cats = [...new Set(dayTasks.map((t) => t.category))];
    cells.push(
      <div
        key={ds}
        className={`calcell ${ds === t0 ? "today" : ""} ${ds === selectedDate ? "selected" : ""}`}
        onClick={() => setSelectedDate(ds)}
      >
        <div className="daynum">{d}</div>
        <div className="caldots">
          {cats.map((c) => (
            <span className={`caldot ${c}`} key={c} />
          ))}
        </div>
      </div>
    );
  }

  const selTasks = state.tasks
    .filter((t) => t.date === selectedDate)
    .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

  return (
    <>
      <div className="card">
        <div className="navrow">
          <button className="ghost" onClick={() => setMonthOffset((o) => o - 1)}>
            ‹ Prev
          </button>
          <div className="qmonth-title" style={{ margin: 0 }}>
            {monthName}
          </div>
          <button className="ghost" onClick={() => setMonthOffset((o) => o + 1)}>
            Next ›
          </button>
        </div>
        <div className="calgrid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div className="calhead" key={d}>
              {d}
            </div>
          ))}
          {cells}
        </div>
      </div>
      <div className="today-grid">
        <div className="card">
          <h2>{fmtDate(selectedDate)}</h2>
          {selTasks.length ? (
            selTasks.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={actions.toggleTask} onDelete={actions.deleteTask} onCategoryChange={actions.updateTaskCategory} />
            ))
          ) : (
            <div className="empty">Nothing on this day.</div>
          )}
          <div className="addrow">
            <input
              type="text"
              placeholder="Add content plan / any task for this day..."
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
            />
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
                actions.addTask(taskInput, taskCat, selectedDate, taskTime);
                setTaskInput("");
                setTaskTime("");
              }}
            >
              Add
            </button>
          </div>
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <h2>Mapped to the day</h2>
          <Timeline dayTasks={selTasks} />
        </div>
      </div>
    </>
  );
}
