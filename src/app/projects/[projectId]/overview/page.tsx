"use client";

import Link from "next/link";
import { use } from "react";
import { useProject, useProjectSites } from "@/shared/api/project.queries";

const steps = [
  ["01", "Site capture", "Add the property, roof boundaries, and obstacles."],
  ["02", "Design", "Build and optimize the 2D solar layout."],
  ["03", "Engineering", "Validate strings, inverter sizing, and electrical design."],
  ["04", "Proposal", "Review energy, financials, BOM, and client documents."],
];

export default function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const project = useProject(projectId);
  const sites = useProjectSites(projectId);

  if (project.isLoading) return <main className="loadingPage">Loading project…</main>;
  if (project.isError || !project.data) return <main className="loadingPage"><h1>Project unavailable</h1><p className="muted">We couldn't load this project. Check your access and try again.</p><Link className="secondary" href="/projects">Back to projects</Link></main>;

  const item = project.data;
  const site = sites.data?.[0];

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar"><Link href="/projects" className="brand">Solar3D</Link><nav><Link href="/projects">Projects</Link><span className="crumb"> / {item.name}</span></nav><div className="avatar">D</div></header>
      <section className="workspace-content">
        <Link href="/projects" className="back">← All projects</Link>
        <div className="projectHero"><div><p className="eyebrow">PROJECT</p><h1>{item.name}</h1><p className="muted">Live project information from your Solar3D workspace.</p></div><Link className="primary" href={`/projects/${projectId}/design`}>Open design →</Link></div>
        <div className="summaryGrid"><div className="card"><span className="muted">Project status</span><strong>{item.status || "Draft"}</strong></div><div className="card"><span className="muted">Site</span><strong>{sites.isLoading ? "Loading…" : site?.name || "Not added"}</strong></div><div className="card"><span className="muted">Coordinates</span><strong>{site?.latitude != null && site?.longitude != null ? `${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}` : "Not available"}</strong></div><div className="card"><span className="muted">Next action</span><strong>Continue design</strong></div></div>
        <h2>Design workflow</h2><div className="workflow">{steps.map(([number, title, description], index) => <div className={`workflowStep ${index === 0 ? "current" : ""}`} key={number}><span>{number}</span><div><h3>{title}</h3><p className="muted">{description}</p></div></div>)}</div>
      </section>
    </main>
  );
}
