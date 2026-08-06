"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, Category, ProjectType, Stage } from "./types";
import { addDays, todayStr } from "./utils";

const EMPTY_STATE: AppState = {
  tasks: [],
  deals: [],
  projects: [],
  projectMilestones: [],
  projectResources: [],
  subs: [],
  financeEntries: [],
  pitchLog: {},
  log: [],
  weekGoals: [],
  q3goals: "",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${init?.method || "GET"} ${url} failed: ${res.status}`);
  return res.json();
}

export function useManifestState() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Surfaced when a completion toggle (task/project/milestone/week goal)
  // fails to save — those optimistically flip the checkbox before the
  // request resolves, so a silent failure would otherwise leave the UI
  // showing "done" for something that was never actually saved, with no way
  // to tell. Distinct from `error` above, which is only for the initial load.
  const [actionError, setActionError] = useState<string | null>(null);

  // A reload's GET can be in flight for a while (especially the one chained
  // after the background Calendar sync below, which waits on a Google API
  // round trip) and resolve well after a toggle's own PATCH has already
  // committed the opposite value. A blind `setState(s)` would then stomp
  // the just-saved change back to its old value with no error, since
  // nothing actually failed — the reload's response was just stale by the
  // time it landed. Any id in one of these sets has a save in flight (or
  // just landed), so reloadState keeps the current local value for it
  // instead of trusting a response that may predate that save.
  const pendingTaskIds = useRef<Set<string>>(new Set());
  const pendingMilestoneIds = useRef<Set<string>>(new Set());
  const pendingGoalIds = useRef<Set<string>>(new Set());

  // Guards the other half of the same staleness problem: two reloadState
  // calls can overlap (e.g. the background Calendar-sync reload below and a
  // toggle's own post-save refresh), and there's no guarantee the one
  // dispatched first also resolves first. Each call claims the next number
  // when it *starts*; if a later-dispatched call has already claimed a
  // higher number by the time this one's fetch resolves, this one is stale
  // by definition (whatever it read, a newer read has since been kicked
  // off) and its response is dropped instead of applied.
  const latestReloadRef = useRef(0);

  const reloadState = useCallback(async () => {
    const mySeq = ++latestReloadRef.current;
    // Only mutations already pending when *this* reload was dispatched are
    // safe to reconcile from its response — anything added afterward (a
    // toggle that started while this GET was already in flight) still needs
    // protecting, since this response was captured before that mutation's
    // own save even began.
    const taskIdsToClear = new Set(pendingTaskIds.current);
    const milestoneIdsToClear = new Set(pendingMilestoneIds.current);
    const goalIdsToClear = new Set(pendingGoalIds.current);
    const s = await api<AppState>("/api/state");
    if (mySeq !== latestReloadRef.current) return;
    taskIdsToClear.forEach((id) => pendingTaskIds.current.delete(id));
    milestoneIdsToClear.forEach((id) => pendingMilestoneIds.current.delete(id));
    goalIdsToClear.forEach((id) => pendingGoalIds.current.delete(id));
    setState((prev) => ({
      ...s,
      tasks: s.tasks.map((t) => (pendingTaskIds.current.has(t.id) ? prev.tasks.find((p) => p.id === t.id) ?? t : t)),
      projectMilestones: s.projectMilestones.map((m) =>
        pendingMilestoneIds.current.has(m.id) ? prev.projectMilestones.find((p) => p.id === m.id) ?? m : m
      ),
      weekGoals: s.weekGoals.map((g) =>
        pendingGoalIds.current.has(g.id) ? prev.weekGoals.find((p) => p.id === g.id) ?? g : g
      ),
    }));
  }, []);

  useEffect(() => {
    // Routed through reloadState (not a bare fetch+setState) so a toggle
    // fired the instant the page loads is covered by the same staleness
    // guards as every later reload — this request is just as capable of
    // resolving after such a toggle's own PATCH has already committed.
    reloadState()
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoaded(true));

    // Fire-and-forget, after the initial paint rather than blocking it: pull
    // fresh Calendar events once per page load, then quietly reload state if
    // anything came in. Errors are swallowed — Calendar not being connected
    // yet is a completely normal case, not a failure worth surfacing here.
    api("/api/calendar/sync", { method: "POST" })
      .then(() => reloadState())
      .catch(() => {});
  }, [reloadState]);

  // The actual Evidence entry is created server-side (see lib/db.ts's
  // logCompletion, called from the PATCH routes) so it fires no matter what
  // client hits the API. This just refreshes local state afterward to pick
  // that entry up — a second client-side POST here would duplicate it.
  const refreshAfterCompletion = useCallback(() => {
    reloadState().catch(() => {});
  }, [reloadState]);

  const addTask = useCallback(
    async (
      title: string,
      category: Category,
      date: string,
      time: string,
      goalId: string | null = null,
      projectMilestoneId: string | null = null
    ) => {
      if (!title.trim()) return;
      const task = await api<AppState["tasks"][number]>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title, category, date, time, goalId, projectMilestoneId }),
      });
      setState((s) => ({ ...s, tasks: [...s.tasks, task] }));
    },
    []
  );

  const toggleTask = useCallback(
    async (id: string) => {
      let prevDone = false;
      let nextDone = false;
      pendingTaskIds.current.add(id);
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (t.id !== id) return t;
          prevDone = t.done;
          nextDone = !t.done;
          return { ...t, done: nextDone };
        }),
      }));
      try {
        await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) });
        // Left pending on success (rather than cleared here) so a reload that
        // was already in flight when this started can't land afterward and
        // stomp it back — reloadState only releases ids it saw pending
        // before it was dispatched, so this clears on the next one dispatched
        // after this point instead, which is guaranteed to read the commit.
        refreshAfterCompletion();
      } catch {
        pendingTaskIds.current.delete(id);
        setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: prevDone } : t)) }));
        setActionError("Couldn't save that — check your connection and try again.");
      }
    },
    [refreshAfterCompletion]
  );

  const assignTaskMilestone = useCallback(async (id: string, projectMilestoneId: string | null) => {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, projectMilestoneId } : t)) }));
    await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ projectMilestoneId }) }).catch(() => {});
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
    await api(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const pushTaskToTomorrow = useCallback(async (id: string) => {
    setState((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (!task) return s;
      const newDate = addDays(task.date, 1);
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, incrementPush: true }),
      }).catch(() => {});
      return {
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, date: newDate, pushCount: t.pushCount + 1 } : t)),
      };
    });
  }, []);

  const updateTaskCategory = useCallback(async (id: string, category: Category) => {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, category } : t)) }));
    await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ category }) }).catch(() => {});
  }, []);

  const addDeal = useCallback(async (brand: string, stage: Stage, value: string) => {
    if (!brand.trim()) return;
    const deal = await api<AppState["deals"][number]>("/api/deals", {
      method: "POST",
      body: JSON.stringify({ brand, stage, value: parseFloat(value) || 0 }),
    });
    setState((s) => ({ ...s, deals: [deal, ...s.deals] }));
  }, []);

  const updateDealStage = useCallback(async (id: string, stage: Stage) => {
    setState((s) => ({ ...s, deals: s.deals.map((d) => (d.id === id ? { ...d, stage } : d)) }));
    await api(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) }).catch(() => {});
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    setState((s) => ({ ...s, deals: s.deals.filter((d) => d.id !== id) }));
    await api(`/api/deals/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const addProject = useCallback(async (name: string, type: ProjectType) => {
    if (!name.trim()) return;
    const project = await api<AppState["projects"][number]>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, type }),
    });
    setState((s) => ({ ...s, projects: [...s.projects, project] }));
  }, []);

  const updateProjectStatus = useCallback(
    async (id: string, status: string) => {
      let prevStatus: AppState["projects"][number]["status"] | undefined;
      let justCompleted = false;
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) => {
          if (p.id !== id) return p;
          prevStatus = p.status;
          justCompleted = status === "done" && p.status !== "done";
          return { ...p, status: status as (typeof p)["status"] };
        }),
      }));
      try {
        await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
        if (justCompleted) refreshAfterCompletion();
      } catch {
        if (prevStatus) {
          setState((s) => ({
            ...s,
            projects: s.projects.map((p) => (p.id === id ? { ...p, status: prevStatus! } : p)),
          }));
        }
        setActionError("Couldn't save that — check your connection and try again.");
      }
    },
    [refreshAfterCompletion]
  );

  const deleteProject = useCallback(async (id: string) => {
    setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }));
    await api(`/api/projects/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const addLog = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const entry = await api<AppState["log"][number]>("/api/log", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    setState((s) => ({ ...s, log: [entry, ...s.log] }));
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    setState((s) => ({ ...s, log: s.log.filter((l) => l.id !== id) }));
    await api(`/api/log/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const addSub = useCallback(async (name: string, amount: string, renewDate: string) => {
    if (!name.trim()) return;
    const sub = await api<AppState["subs"][number]>("/api/subs", {
      method: "POST",
      body: JSON.stringify({ name, amount: parseFloat(amount) || 0, renewDate }),
    });
    setState((s) => ({ ...s, subs: [...s.subs, sub] }));
  }, []);

  const deleteSub = useCallback(async (id: string) => {
    setState((s) => ({ ...s, subs: s.subs.filter((sub) => sub.id !== id) }));
    await api(`/api/subs/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const bumpPitch = useCallback(async (delta: number) => {
    const t0 = todayStr();
    setState((s) => ({
      ...s,
      pitchLog: { ...s.pitchLog, [t0]: Math.max(0, (s.pitchLog[t0] || 0) + delta) },
    }));
    await api(`/api/pitch-log`, { method: "POST", body: JSON.stringify({ delta }) }).catch(() => {});
  }, []);

  const addProjectMilestone = useCallback(async (projectId: string, title: string) => {
    if (!title.trim()) return;
    const milestone = await api<AppState["projectMilestones"][number]>("/api/project-milestones", {
      method: "POST",
      body: JSON.stringify({ projectId, title }),
    });
    setState((s) => ({ ...s, projectMilestones: [...s.projectMilestones, milestone] }));
  }, []);

  const toggleProjectMilestone = useCallback(
    async (id: string) => {
      let prevDone = false;
      let nextDone = false;
      pendingMilestoneIds.current.add(id);
      setState((s) => ({
        ...s,
        projectMilestones: s.projectMilestones.map((m) => {
          if (m.id !== id) return m;
          prevDone = m.done;
          nextDone = !m.done;
          return { ...m, done: nextDone };
        }),
      }));
      try {
        await api(`/api/project-milestones/${id}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) });
        refreshAfterCompletion();
      } catch {
        pendingMilestoneIds.current.delete(id);
        setState((s) => ({
          ...s,
          projectMilestones: s.projectMilestones.map((m) => (m.id === id ? { ...m, done: prevDone } : m)),
        }));
        setActionError("Couldn't save that — check your connection and try again.");
      }
    },
    [refreshAfterCompletion]
  );

  const deleteProjectMilestone = useCallback(async (id: string) => {
    setState((s) => ({
      ...s,
      projectMilestones: s.projectMilestones.filter((m) => m.id !== id),
      tasks: s.tasks.map((t) => (t.projectMilestoneId === id ? { ...t, projectMilestoneId: null } : t)),
    }));
    await api(`/api/project-milestones/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const addProjectResource = useCallback(async (projectId: string, label: string, url: string) => {
    if (!label.trim() || !url.trim()) return;
    const resource = await api<AppState["projectResources"][number]>("/api/project-resources", {
      method: "POST",
      body: JSON.stringify({ projectId, label, url }),
    });
    setState((s) => ({ ...s, projectResources: [...s.projectResources, resource] }));
  }, []);

  const deleteProjectResource = useCallback(async (id: string) => {
    setState((s) => ({ ...s, projectResources: s.projectResources.filter((r) => r.id !== id) }));
    await api(`/api/project-resources/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const saveQ3Goals = useCallback(async (text: string) => {
    setState((s) => ({ ...s, q3goals: text }));
    await api(`/api/settings`, { method: "PUT", body: JSON.stringify({ q3goals: text }) }).catch(() => {});
  }, []);

  const addWeekGoal = useCallback(async (text: string, weekStart: string) => {
    if (!text.trim()) return;
    const goal = await api<AppState["weekGoals"][number]>("/api/week-goals", {
      method: "POST",
      body: JSON.stringify({ text, weekStart }),
    });
    setState((s) => ({ ...s, weekGoals: [...s.weekGoals, goal] }));
  }, []);

  const toggleWeekGoalDone = useCallback(
    async (id: string) => {
      let prevDone = false;
      let nextDone = false;
      pendingGoalIds.current.add(id);
      setState((s) => ({
        ...s,
        weekGoals: s.weekGoals.map((g) => {
          if (g.id !== id) return g;
          prevDone = g.done;
          nextDone = !g.done;
          return { ...g, done: nextDone };
        }),
      }));
      try {
        await api(`/api/week-goals/${id}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) });
        refreshAfterCompletion();
      } catch {
        pendingGoalIds.current.delete(id);
        setState((s) => ({
          ...s,
          weekGoals: s.weekGoals.map((g) => (g.id === id ? { ...g, done: prevDone } : g)),
        }));
        setActionError("Couldn't save that — check your connection and try again.");
      }
    },
    [refreshAfterCompletion]
  );

  const syncFromNotion = useCallback(async () => {
    const result = await api<{ tasksSynced: number; goalsSynced: number; skipped: number; pushed: number }>(
      "/api/notion/sync-tasks",
      { method: "POST" }
    );
    await reloadState();
    return result;
  }, [reloadState]);

  const syncGoogleCalendar = useCallback(async () => {
    const result = await api<{ synced: number; skipped: number }>("/api/calendar/sync", { method: "POST" });
    await reloadState();
    return result;
  }, [reloadState]);

  const deleteWeekGoal = useCallback(async (id: string) => {
    setState((s) => ({
      ...s,
      weekGoals: s.weekGoals.filter((g) => g.id !== id),
      tasks: s.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
    }));
    await api(`/api/week-goals/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  return {
    state,
    loaded,
    error,
    actionError,
    clearActionError: useCallback(() => setActionError(null), []),
    actions: {
      addTask,
      toggleTask,
      assignTaskMilestone,
      deleteTask,
      pushTaskToTomorrow,
      updateTaskCategory,
      addDeal,
      updateDealStage,
      deleteDeal,
      addProject,
      updateProjectStatus,
      deleteProject,
      addLog,
      deleteLog,
      addSub,
      deleteSub,
      bumpPitch,
      addProjectMilestone,
      toggleProjectMilestone,
      deleteProjectMilestone,
      addProjectResource,
      deleteProjectResource,
      saveQ3Goals,
      addWeekGoal,
      toggleWeekGoalDone,
      deleteWeekGoal,
      syncFromNotion,
      syncGoogleCalendar,
    },
  };
}

export type ManifestActions = ReturnType<typeof useManifestState>["actions"];
