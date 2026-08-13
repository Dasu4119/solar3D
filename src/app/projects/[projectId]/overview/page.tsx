import Link from "next/link";

const steps = [
  ["01", "Site capture", "Add the property, roof boundaries, and obstacles."],
  ["02", "Design", "Build and optimize the 2D solar layout."],
  ["03", "Engineering", "Validate strings, inverter sizing, and electrical design."],
  ["04", "Proposal", "Review energy, financials, BOM, and client documents."],
];

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <main className="workspace-shell">
      <header className="workspace-topbar"><Link href="/projects" className="brand">Solar3D</Link><nav><Link href="/projects">Projects</Link></nav><div className="avatar">D</div></header>
      <section className="workspace-content">
        <Link href="/projects" className="back">← All projects</Link>
        <div className="projectHero"><div><p className="eyebrow">PROJECT</p><h1>Commercial Rooftop</h1><p className="muted">Project ID: {projectId}</p></div><Link className="primary" href={`/projects/${projectId}/design`}>Open design →</Link></div>
        <div className="summaryGrid"><div className="card"><span className="muted">System size</span><strong>82.4 kWp</strong></div><div className="card"><span className="muted">Project status</span><strong>In design</strong></div><div className="card"><span className="muted">Site</span><strong>Survey pending</strong></div><div className="card"><span className="muted">Next action</span><strong>Capture site</strong></div></div>
        <h2>Design workflow</h2><div className="workflow">{steps.map(([number, title, description]) => <div className="workflowStep" key={number}><span>{number}</span><div><h3>{title}</h3><p className="muted">{description}</p></div></div>)}</div>
      </section>
    </main>
  );
}
