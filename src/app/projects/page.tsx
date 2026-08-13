"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useProjects } from "@/shared/api/project.queries";
import type { Project } from "@/shared/types/domain";

function projectName(project: Project) {
  return project.name || "Untitled project";
}

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: projects, isLoading, isError, error, refetch } = useProjects();

  const filtered = useMemo(() => {
    const source = projects ?? [];
    return source.filter((project) => {
      const matchesSearch = projectName(project).toLowerCase().includes(search.toLowerCase());
      const matchesStatus = status === "all" || project.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, status]);

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <Link href="/dashboard" className="brand">Solar3D</Link>
        <nav><Link href="/projects" className="active">Projects</Link></nav>
        <div className="avatar">D</div>
      </header>
      <section className="workspace-content">
        <div className="page-heading">
          <div><p className="eyebrow">PROJECTS</p><h1>Your projects</h1><p className="muted">Create, review, and continue solar designs from one workspace.</p></div>
          <button className="primary" type="button">+ New project</button>
        </div>
        <div className="toolbar">
          <input aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." />
          <select aria-label="Project status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option><option value="site_capture">Site capture</option><option value="in_design">In design</option><option value="proposal">Proposal</option>
          </select>
        </div>
        {isLoading && <div className="emptyState"><strong>Loading projects…</strong><span>Getting your latest projects from Solar3D.</span></div>}
        {isError && <div className="emptyState"><strong>We couldn't load your projects.</strong><span>{error instanceof Error ? error.message : "Please try again."}</span><button className="secondary" onClick={() => refetch()}>Retry</button></div>}
        {!isLoading && !isError && filtered.length === 0 && <div className="emptyState"><strong>{projects?.length ? "No matching projects" : "No projects yet"}</strong><span>{projects?.length ? "Try another search or status." : "Create your first solar project to begin."}</span></div>}
        {!isLoading && !isError && filtered.length > 0 && <div className="projectTable">{filtered.map((project) => <Link href={`/projects/${project.id}/overview`} className="projectRow" key={project.id}><div><strong>{projectName(project)}</strong><span>Project</span></div><div><span className="muted">{project.status ?? "Not started"}</span></div><div><strong>Open workspace</strong></div><span className="status">{project.status ?? "Draft"}</span><span className="arrow">→</span></Link>)}</div>}
      </section>
    </main>
  );
}
