"use client";

import { useState } from "react";
import type { ManifestActions } from "@/lib/useManifestState";
import { CATEGORIES, CATEGORY_LABEL, type AppState, type Category, type ProjectMilestone, type Task } from "@/lib/types";
import { fmtDate, fmtHour, todayStr } from "@/lib/utils";

export function TaskRow({
  task,
  showPush,
  onToggle,
  onDelete,
  onPushTomorrow,
  onCategoryChange,
}: {
  task: Task;
  showPush?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPushTomorrow?: (id: string) => void;
  onCategoryChange: (id: string, category: Category) => void;
}) {
  return (
    <div className={`taskrow ${task.done ? "done" : ""}`}>
      <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
      <select
        className={`tag ${task.category}`}
        value={task.category}
        onChange={(e) => onCategoryChange(task.id, e.target.value as Category)}
      >
        {CATEGORIES.map((c) => (
          <option value={c} key={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      {task.fromCalendar ? (
        <span className="tag" style={{ background: "rgba(91,138,130,.2)", color: "var(--teal)" }}>
          📅 cal
        </span>
      ) : null}
      {task.fromNotion ? (
        <span className="tag" style={{ background: "rgba(201,161,90,.15)", color: "var(--gold)" }}>
          📓 notion
        </span>
      ) : null}
      {task.time ? <span className="time">{task.time}</span> : null}
      <span className="title">{task.title}</span>
      {task.pushCount ? (
        <span
          className="tag"
          style={{ background: "rgba(181,101,74,.15)", color: "var(--danger)" }}
          title={`Pushed/missed ${task.pushCount} time${task.pushCount > 1 ? "s" : ""}`}
        >
          ↻{task.pushCount}
        </span>
      ) : null}
      {showPush && onPushTomorrow ? (
        <button
          className="ghost"
          style={{ padding: "3px 8px", fontSize: "11px" }}
          onClick={() => onPushTomorrow(task.id)}
        >
          → Tomorrow
        </button>
      ) : null}
      <button className="smallx" onClick={() => onDelete(task.id)}>
        ×
      </button>
    </div>
  );
}

export function Timeline({ dayTasks }: { dayTasks: Task[] }) {
  const unscheduled = dayTasks.filter((t) => !t.time);
  const hours: number[] = [];
  for (let h = 6; h <= 22; h++) hours.push(h);

  return (
    <>
      {unscheduled.length ? (
        <div style={{ marginBottom: "12px" }}>
          <div className="checkin-q" style={{ marginBottom: "6px" }}>
            No time set
          </div>
          {unscheduled.map((t) => (
            <div key={t.id} className={`timeblock ${t.category} ${t.done ? "done" : ""}`}>
              {t.title}
            </div>
          ))}
        </div>
      ) : null}
      {hours.map((h) => {
        const items = dayTasks.filter((t) => t.time && parseInt(t.time.split(":")[0], 10) === h);
        return (
          <div className="hourrow" key={h}>
            <div className="hourlabel">{fmtHour(h)}</div>
            <div className="hourtasks">
              {items.map((t) => (
                <div key={t.id} className={`timeblock ${t.category} ${t.done ? "done" : ""}`}>
                  {t.time} · {t.title}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function WeekSquares({
  days,
  compact,
  state,
  actions,
}: {
  days: string[];
  compact: boolean;
  state: AppState;
  actions: ManifestActions;
}) {
  const t0 = todayStr();
  const sz = compact ? "70px" : "140px";
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const dayTasksFor = (ds: string) =>
    state.tasks.filter((t) => t.date === ds).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const dayLogsFor = (ds: string) => state.log.filter((l) => l.date === ds);

  return (
    <>
      <div className="grid3" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: compact ? "6px" : "8px" }}>
        {days.map((ds) => {
          const dayTasks = dayTasksFor(ds);
          const dayLogs = dayLogsFor(ds);
          const done = dayTasks.filter((t) => t.done).length;
          const weekday = new Date(ds + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

          return (
            <div
              className={`calcell ${ds === t0 ? "today" : ""} ${ds === selectedDay ? "selected" : ""}`}
              style={{ minHeight: sz }}
              key={ds}
              onClick={() => setSelectedDay((cur) => (cur === ds ? null : ds))}
            >
              <div className="daynum">
                {weekday} {ds.slice(8, 10)}
              </div>
              {dayTasks.length ? (
                <div style={{ fontSize: "10px", color: "var(--muted)", margin: "4px 0" }}>
                  {done}/{dayTasks.length} done
                </div>
              ) : null}
              {dayLogs.length ? (
                <div style={{ fontSize: "10px", color: "var(--gold)", margin: "4px 0" }}>
                  📝 {dayLogs.length} logged
                </div>
              ) : null}
              {!compact
                ? dayTasks.slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        fontSize: "10.5px",
                        padding: "2px 0",
                        textDecoration: t.done ? "line-through" : "none",
                        color: t.done ? "var(--muted)" : undefined,
                      }}
                    >
                      {t.title.slice(0, 22)}
                      {t.title.length > 22 ? "…" : ""}
                    </div>
                  ))
                : null}
              {!compact && dayTasks.length > 4 ? (
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>+{dayTasks.length - 4} more</div>
              ) : null}
              {!compact && !dayTasks.length ? (
                <div className="empty" style={{ fontSize: "10.5px" }}>
                  —
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {selectedDay ? (
        <div className="milestonelist">
          <div className="checkin-q" style={{ marginBottom: "6px" }}>
            {fmtDate(selectedDay)}
          </div>
          {dayTasksFor(selectedDay).length ? (
            dayTasksFor(selectedDay).map((t) => (
              <TaskRow key={t.id} task={t} onToggle={actions.toggleTask} onDelete={actions.deleteTask} onCategoryChange={actions.updateTaskCategory} />
            ))
          ) : (
            <div className="empty">Nothing scheduled.</div>
          )}
          {dayLogsFor(selectedDay).length ? (
            <>
              <div className="checkin-q" style={{ margin: "12px 0 6px" }}>
                Evidence
              </div>
              {dayLogsFor(selectedDay).map((l) => (
                <div className="logentry" key={l.id}>
                  <div style={{ whiteSpace: "pre-line" }}>{l.text}</div>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function WeekGoalsList({
  weekStart,
  state,
  actions,
}: {
  weekStart: string;
  state: AppState;
  actions: ManifestActions;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; date: string; cat: Category }>>({});

  const goals = state.weekGoals.filter((g) => g.weekStart === weekStart);

  const draftFor = (goalId: string) => drafts[goalId] ?? { title: "", date: todayStr(), cat: "content" as Category };
  const setDraft = (goalId: string, patch: Partial<{ title: string; date: string; cat: Category }>) => {
    setDrafts((d) => ({ ...d, [goalId]: { ...draftFor(goalId), ...patch } }));
  };

  return (
    <>
      {goals.length ? (
        goals.map((g) => {
          const isOpen = !!expanded[g.id];
          const draft = draftFor(g.id);
          const linkedTasks = state.tasks.filter((t) => t.goalId === g.id);
          return (
            <div className="miniitem" style={{ alignItems: "flex-start", flexDirection: "column" }} key={g.id}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", cursor: "pointer" }}
                onClick={() => setExpanded((e) => ({ ...e, [g.id]: !e[g.id] }))}
              >
                <input
                  type="checkbox"
                  checked={g.done}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => actions.toggleWeekGoalDone(g.id)}
                />
                <span
                  className="name"
                  style={{ textDecoration: g.done ? "line-through" : "none", color: g.done ? "var(--muted)" : undefined }}
                >
                  {g.text}
                </span>
                {g.fromNotion ? (
                  <span className="tag" style={{ background: "rgba(201,161,90,.15)", color: "var(--gold)" }}>
                    📓 notion
                  </span>
                ) : null}
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{isOpen ? "▾" : "▸"}</span>
                <button
                  className="smallx"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.deleteWeekGoal(g.id);
                  }}
                >
                  ×
                </button>
              </div>
              {isOpen ? (
                <div style={{ width: "100%", margin: "8px 0 4px 24px" }}>
                  {linkedTasks.length ? (
                    linkedTasks.map((t) => (
                      <TaskRow key={t.id} task={t} onToggle={actions.toggleTask} onDelete={actions.deleteTask} onCategoryChange={actions.updateTaskCategory} />
                    ))
                  ) : (
                    <div className="empty">No tasks linked yet.</div>
                  )}
                  <div className="addrow">
                    <input
                      type="text"
                      placeholder="Add a task under this goal..."
                      value={draft.title}
                      onChange={(e) => setDraft(g.id, { title: e.target.value })}
                    />
                    <input type="date" value={draft.date} onChange={(e) => setDraft(g.id, { date: e.target.value })} />
                    <select value={draft.cat} onChange={(e) => setDraft(g.id, { cat: e.target.value as Category })}>
                      {CATEGORIES.map((c) => (
                        <option value={c} key={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      onClick={() => {
                        actions.addTask(draft.title, draft.cat, draft.date || todayStr(), "", g.id);
                        setDraft(g.id, { title: "" });
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      ) : (
        <div className="empty">No goals set for this week yet.</div>
      )}
    </>
  );
}

export function AddWeekGoalRow({ weekStart, actions }: { weekStart: string; actions: ManifestActions }) {
  const [text, setText] = useState("");
  return (
    <div className="addrow">
      <input type="text" placeholder="Add a goal for this week..." value={text} onChange={(e) => setText(e.target.value)} />
      <button
        className="primary"
        onClick={() => {
          actions.addWeekGoal(text, weekStart);
          setText("");
        }}
      >
        Add goal
      </button>
    </div>
  );
}

/**
 * One equal-width segment per milestone. Each segment fills based on that
 * specific milestone's own linked tasks (done/total), reaching 100% exactly
 * when the milestone completes — not a single bar for the whole project.
 */
export function ProjectProgressBar({ milestones, tasks }: { milestones: ProjectMilestone[]; tasks: Task[] }) {
  if (!milestones.length) return null;
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {milestones.map((m) => {
        const linked = tasks.filter((t) => t.projectMilestoneId === m.id);
        const pct = m.done ? 100 : linked.length ? Math.round((linked.filter((t) => t.done).length / linked.length) * 100) : 0;
        return (
          <div
            key={m.id}
            title={`${m.title} — ${pct}%`}
            style={{ flex: 1, height: "12px", background: "var(--surface-2)", borderRadius: "999px", overflow: "hidden" }}
          >
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--gold)", borderRadius: "999px" }} />
          </div>
        );
      })}
    </div>
  );
}

export function ProjectMilestonesList({
  projectId,
  state,
  actions,
}: {
  projectId: string;
  state: AppState;
  actions: ManifestActions;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; date: string; cat: Category }>>({});

  const milestones = state.projectMilestones.filter((m) => m.projectId === projectId);

  const draftFor = (milestoneId: string) =>
    drafts[milestoneId] ?? { title: "", date: todayStr(), cat: "content" as Category };
  const setDraft = (milestoneId: string, patch: Partial<{ title: string; date: string; cat: Category }>) => {
    setDrafts((d) => ({ ...d, [milestoneId]: { ...draftFor(milestoneId), ...patch } }));
  };

  return (
    <>
      {milestones.length ? (
        milestones.map((m) => {
          const isOpen = !!expanded[m.id];
          const draft = draftFor(m.id);
          const linkedTasks = state.tasks.filter((t) => t.projectMilestoneId === m.id);
          return (
            <div className="miniitem" style={{ alignItems: "flex-start", flexDirection: "column" }} key={m.id}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", cursor: "pointer" }}
                onClick={() => setExpanded((e) => ({ ...e, [m.id]: !e[m.id] }))}
              >
                <input
                  type="checkbox"
                  checked={m.done}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => actions.toggleProjectMilestone(m.id)}
                />
                <span
                  className="name"
                  style={{ textDecoration: m.done ? "line-through" : "none", color: m.done ? "var(--muted)" : undefined }}
                >
                  {m.title}
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {linkedTasks.filter((t) => t.done).length}/{linkedTasks.length}
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{isOpen ? "▾" : "▸"}</span>
                <button
                  className="smallx"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.deleteProjectMilestone(m.id);
                  }}
                >
                  ×
                </button>
              </div>
              {isOpen ? (
                <div style={{ width: "100%", margin: "8px 0 4px 24px" }}>
                  {linkedTasks.length ? (
                    linkedTasks.map((t) => (
                      <TaskRow key={t.id} task={t} onToggle={actions.toggleTask} onDelete={actions.deleteTask} onCategoryChange={actions.updateTaskCategory} />
                    ))
                  ) : (
                    <div className="empty">No tasks linked yet.</div>
                  )}
                  <div className="addrow">
                    <input
                      type="text"
                      placeholder="Add a task under this milestone..."
                      value={draft.title}
                      onChange={(e) => setDraft(m.id, { title: e.target.value })}
                    />
                    <input type="date" value={draft.date} onChange={(e) => setDraft(m.id, { date: e.target.value })} />
                    <select value={draft.cat} onChange={(e) => setDraft(m.id, { cat: e.target.value as Category })}>
                      {CATEGORIES.map((c) => (
                        <option value={c} key={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary"
                      onClick={() => {
                        actions.addTask(draft.title, draft.cat, draft.date || todayStr(), "", null, m.id);
                        setDraft(m.id, { title: "" });
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      ) : (
        <div className="empty">No milestones yet.</div>
      )}
    </>
  );
}

export function AddProjectMilestoneRow({ projectId, actions }: { projectId: string; actions: ManifestActions }) {
  const [title, setTitle] = useState("");
  return (
    <div className="addrow">
      <input
        type="text"
        placeholder="Add a milestone for this project..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        className="primary"
        onClick={() => {
          actions.addProjectMilestone(projectId, title);
          setTitle("");
        }}
      >
        Add milestone
      </button>
    </div>
  );
}

export function ProjectResourcesCard({
  projectId,
  state,
  actions,
}: {
  projectId: string;
  state: AppState;
  actions: ManifestActions;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const resources = state.projectResources.filter((r) => r.projectId === projectId);

  return (
    <div className="card">
      <h2>Resources</h2>
      {resources.length ? (
        resources.map((r) => (
          <div className="miniitem" key={r.id}>
            <span className="name">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="linklike">
                {r.label}
              </a>
            </span>
            <button className="smallx" onClick={() => actions.deleteProjectResource(r.id)}>
              ×
            </button>
          </div>
        ))
      ) : (
        <div className="empty">No resources yet.</div>
      )}
      <div className="addrow">
        <input type="text" placeholder="Label..." value={label} onChange={(e) => setLabel(e.target.value)} />
        <input type="text" placeholder="URL..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="primary"
          onClick={() => {
            actions.addProjectResource(projectId, label, url);
            setLabel("");
            setUrl("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
