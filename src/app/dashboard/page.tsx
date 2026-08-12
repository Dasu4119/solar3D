import Link from "next/link";

export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <p style={{ margin: 0, color: "#64748b" }}>Solar3D</p>
          <h1 style={{ margin: "6px 0 0" }}>Projects</h1>
        </div>
        <Link href="/projects" style={{ padding: "10px 16px", border: "1px solid #d1d5db", borderRadius: 8 }}>
          Open projects
        </Link>
      </header>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        {[
          ["Active projects", "—"],
          ["Designs", "—"],
          ["Proposals", "—"],
        ].map(([label, value]) => (
          <article key={label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
            <p style={{ margin: 0, color: "#64748b" }}>{label}</p>
            <strong style={{ display: "block", marginTop: 8, fontSize: 28 }}>{value}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
