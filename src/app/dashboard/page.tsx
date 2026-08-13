import Link from "next/link";

const stats = [
  ["Active projects", "12"],
  ["Designs in progress", "7"],
  ["Ready for proposal", "4"],
  ["Estimated capacity", "186 kWp"],
];

export default function DashboardPage() {
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
        <div className="sectionHead"><div><h2>Recent projects</h2><p className="muted">Your latest design work.</p></div><Link href="/projects">See all</Link></div>
        <div className="projectGrid">
          <Link href="/projects" className="projectCard"><div className="projectVisual"/><div><h3>Commercial Rooftop</h3><p className="muted">Design · 82.4 kWp</p></div><span className="status">In design</span></Link>
          <Link href="/projects" className="projectCard"><div className="projectVisual"/><div><h3>Residential Solar</h3><p className="muted">Proposal · 14.8 kWp</p></div><span className="status ready">Ready</span></Link>
        </div>
      </section>
    </main>
  );
}
