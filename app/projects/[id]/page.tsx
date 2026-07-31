"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PROJECT_STATUSES } from "@/lib/types";
import { useManifestState } from "@/lib/useManifestState";
import { AddProjectMilestoneRow, ProjectMilestonesList, ProjectProgressBar, TaskRow } from "@/components/shared";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { state, loaded, error, actions } = useManifestState();

  if (!loaded) return <div className="loadmsg">Loading…</div>;
  if (error) {
    return (
      <div className="loadmsg">
        Couldn&apos;t load the manifest — the database isn&apos;t reachable ({error}).
      </div>
    );
  }

  const project = state.projects.find((p) => p.id === id);
  const backLink = (
    <Link href="/" style={{ color: "var(--muted)", fontSize: "12px" }}>
      ← Back to Dashboard
    </Link>
  );

  if (!project) {
    return (
      <div className="main">
        {backLink}
        <div className="empty" style={{ marginTop: "20px" }}>
          Project not found.
        </div>
      </div>
    );
  }

  const milestones = state.projectMilestones.filter((m) => m.projectId === project.id);
  const unassignedTasks = state.tasks.filter((t) => t.projectId === project.id && !t.projectMilestoneId);

  return (
    <div className="main">
      {backLink}
      <div className="datebar" style={{ marginTop: "14px" }}>
        {project.type}
      </div>
      <h1>{project.name}</h1>

      <div className="card">
        <h2>Status</h2>
        <select value={project.status} onChange={(e) => actions.updateProjectStatus(project.id, e.target.value)}>
          {PROJECT_STATUSES.map((s) => (
            <option value={s} key={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <h2>Progress</h2>
        {milestones.length ? (
          <ProjectProgressBar milestones={milestones} tasks={state.tasks} />
        ) : (
          <div className="empty">Add a milestone below to start tracking progress.</div>
        )}
      </div>

      <div className="card">
        <h2>Milestones</h2>
        <ProjectMilestonesList projectId={project.id} state={state} actions={actions} />
        <AddProjectMilestoneRow projectId={project.id} actions={actions} />
      </div>

      {unassignedTasks.length ? (
        <div className="card">
          <h2>
            Unassigned tasks{" "}
            <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>
              tagged to this project, not yet under a milestone
            </span>
          </h2>
          {unassignedTasks.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={actions.toggleTask} onDelete={actions.deleteTask} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
