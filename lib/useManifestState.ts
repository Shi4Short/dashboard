"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppState, Category, MilestoneTrack, ProjectType, Stage } from "./types";
import { addDays, todayStr } from "./utils";

const EMPTY_STATE: AppState = {
  tasks: [],
  deals: [],
  projects: [],
  milestones: { weavy: [], webflow: [] },
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

  const reloadState = useCallback(async () => {
    const s = await api<AppState>("/api/state");
    setState(s);
  }, []);

  useEffect(() => {
    api<AppState>("/api/state")
      .then((s) => setState(s))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoaded(true));
  }, []);

  // Best-effort: a failed evidence log shouldn't block the completion toggle
  // itself, so this swallows its own errors rather than propagating them.
  const logCompletion = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      const entry = await api<AppState["log"][number]>("/api/log", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setState((s) => ({ ...s, log: [entry, ...s.log] }));
    } catch {
      // ignore
    }
  }, []);

  const addTask = useCallback(
    async (title: string, category: Category, date: string, time: string, goalId: string | null = null) => {
      if (!title.trim()) return;
      const task = await api<AppState["tasks"][number]>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title, category, date, time, goalId }),
      });
      setState((s) => ({ ...s, tasks: [...s.tasks, task] }));
    },
    []
  );

  const toggleTask = useCallback(
    async (id: string) => {
      let nextDone = false;
      let title = "";
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (t.id !== id) return t;
          nextDone = !t.done;
          title = t.title;
          return { ...t, done: nextDone };
        }),
      }));
      await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) }).catch(() => {});
      if (nextDone) logCompletion(title);
    },
    [logCompletion]
  );

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
      let justCompleted = false;
      let name = "";
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) => {
          if (p.id !== id) return p;
          justCompleted = status === "done" && p.status !== "done";
          name = p.name;
          return { ...p, status: status as (typeof p)["status"] };
        }),
      }));
      await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
      if (justCompleted) logCompletion(`Completed: ${name}`);
    },
    [logCompletion]
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

  const addMilestone = useCallback(async (track: MilestoneTrack, title: string) => {
    if (!title.trim()) return;
    const milestone = await api<AppState["milestones"]["weavy"][number]>("/api/milestones", {
      method: "POST",
      body: JSON.stringify({ track, title }),
    });
    setState((s) => ({
      ...s,
      milestones: { ...s.milestones, [track]: [...s.milestones[track], milestone] },
    }));
  }, []);

  const toggleMilestone = useCallback(
    async (track: MilestoneTrack, id: string) => {
      let nextDone = false;
      let title = "";
      setState((s) => {
        const items = s.milestones[track].map((m) => {
          if (m.id === id) {
            nextDone = !m.done;
            title = m.title;
            return { ...m, done: nextDone };
          }
          return m;
        });
        return { ...s, milestones: { ...s.milestones, [track]: items } };
      });
      await api(`/api/milestones/${id}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) }).catch(
        () => {}
      );
      if (nextDone) {
        const trackLabel = track === "weavy" ? "Weavy" : "Webflow";
        logCompletion(`${trackLabel} milestone: ${title}`);
      }
    },
    [logCompletion]
  );

  const deleteMilestone = useCallback(async (track: MilestoneTrack, id: string) => {
    setState((s) => ({
      ...s,
      milestones: { ...s.milestones, [track]: s.milestones[track].filter((m) => m.id !== id) },
    }));
    await api(`/api/milestones/${id}`, { method: "DELETE" }).catch(() => {});
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
      let nextDone = false;
      let text = "";
      setState((s) => ({
        ...s,
        weekGoals: s.weekGoals.map((g) => {
          if (g.id !== id) return g;
          nextDone = !g.done;
          text = g.text;
          return { ...g, done: nextDone };
        }),
      }));
      await api(`/api/week-goals/${id}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) }).catch(
        () => {}
      );
      if (nextDone) logCompletion(`Week goal: ${text}`);
    },
    [logCompletion]
  );

  const syncFromNotion = useCallback(async () => {
    const result = await api<{ tasksSynced: number; goalsSynced: number; skipped: number }>(
      "/api/notion/sync-tasks",
      { method: "POST" }
    );
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
    actions: {
      addTask,
      toggleTask,
      deleteTask,
      pushTaskToTomorrow,
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
      addMilestone,
      toggleMilestone,
      deleteMilestone,
      saveQ3Goals,
      addWeekGoal,
      toggleWeekGoalDone,
      deleteWeekGoal,
      syncFromNotion,
    },
  };
}

export type ManifestActions = ReturnType<typeof useManifestState>["actions"];
