"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProjects } from "@/shared/api/project.queries";
import type { Project } from "@/shared/types/domain";

function projectName(project: Project) {
  return project.name || "Untitled project";
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "in_design":
      return "In design";
    case "proposal":
      return "Proposal";
    case "site_capture":
      return "Site capture";
    default:
      return status || "Draft";
  }
}

export default function DashboardPage() {
  const { data: projects, isLoading, isError, error, refetch } = useProjects();
  const source = projects ?? [];

  const stats = useMemo(() => {
    const active = source.filter((project) => project.status !== "completed").length;
    const inDesign = source.filter((project) => project.status === "in_design").length;
    const proposal = source.filter((project) => project.status === "proposal").length;

    return [
      ["Active projects", String(active)],
      ["Designs in progress", String(inDesign)],
      ["Ready for proposal", String(proposal)],
      ["Estimated capacity", "—"],
    ];
  }, [source]);

  const recentProjects = source.slice(0, 2);

  return (
    <main className="shell">
      <header className="topbar">
        <div><strong>Solar3D</strong><span className="muted">Solar design workspace</span></div>
        <div className="avatar">D</div>
      </header>
      <section className="content">
        <div className="hero">
          <div><p className="eyebrow">WORKSPACE</p><h1>Good morning</h1><p className="muted">Manage your solar projects and continue where you left off.</p></div>
          <Link className="primary" href="/projects">View projects</Link>
        </div>
        <div className="stats">{stats.map(([label, value]) => <div className="card" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div>
        {isLoading && <div className="emptyState"><strong>Loading projects…</strong><span>Getting your latest projects from Solar3D.</span></div>}
        {isError && <div className="emptyState"><strong>We couldn't load your projects.</strong><span>{error instanceof Error ? error.message : "Please try again."}</span><button className="secondary" onClick={() => refetch()}>Retry</button></div>}
        {!isLoading && !isError && <>
          <div className="sectionHead"><div><h2>Recent projects</h2><p className="muted">Your latest design work.</p></div><Link href="/projects">See all</Link></div>
          <div className="projectGrid">
            {recentProjects.map((project) => <Link href={`/projects/${project.id}/overview`} className="projectCard" key={project.id}><div className="projectVisual"/><div><h3>{projectName(project)}</h3><p className="muted">Project · {statusLabel(project.status)}</p></div><span className={`status${project.status === "proposal" ? " ready" : ""}`}>{statusLabel(project.status)}</span></Link>)}
            {recentProjects.length === 0 && <div className="emptyState"><strong>No projects yet</strong><span>Create your first solar project to begin.</span></div>}
          </div>
        </>}
      </section>
    </main>
  );
}
