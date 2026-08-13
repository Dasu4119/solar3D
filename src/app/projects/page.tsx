import Link from "next/link";

const projects = [
  { id: "demo-commercial", name: "Commercial Rooftop", customer: "Commercial Client", location: "Site survey pending", size: "82.4 kWp", status: "In design", updated: "Today" },
  { id: "demo-residential", name: "Residential Solar", customer: "Residential Client", location: "Roof survey complete", size: "14.8 kWp", status: "Proposal", updated: "Yesterday" },
  { id: "demo-industrial", name: "Industrial Expansion", customer: "Industrial Client", location: "Site confirmed", size: "210 kWp", status: "Site capture", updated: "3 days ago" },
];

export default function ProjectsPage() {
  return (
    <main className="workspace-shell">
      <header className="workspace-topbar"><Link href="/dashboard" className="brand">Solar3D</Link><nav><Link href="/projects" className="active">Projects</Link></nav><div className="avatar">D</div></header>
      <section className="workspace-content">
        <div className="page-heading"><div><p className="eyebrow">PROJECTS</p><h1>Your projects</h1><p className="muted">Create, review, and continue solar designs from one workspace.</p></div><button className="primary" type="button">+ New project</button></div>
        <div className="toolbar"><input aria-label="Search projects" placeholder="Search projects..." /><select aria-label="Project status" defaultValue="all"><option value="all">All statuses</option><option>Site capture</option><option>In design</option><option>Proposal</option></select></div>
        <div className="projectTable">{projects.map((project) => <Link href={`/projects/${project.id}/overview`} className="projectRow" key={project.id}><div><strong>{project.name}</strong><span>{project.customer}</span></div><div><span className="muted">{project.location}</span></div><div><strong>{project.size}</strong><span>{project.updated}</span></div><span className="status">{project.status}</span><span className="arrow">→</span></Link>)}</div>
      </section>
    </main>
  );
}
