import Link from "next/link";

export default function ProjectsPage() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
      <Link href="/dashboard">← Dashboard</Link>
      <div style={{ marginTop: 24 }}>
        <h1>Projects</h1>
        <p style={{ color: "#64748b" }}>Projects will be loaded from the authenticated Supabase organization.</p>
      </div>
      <div style={{ marginTop: 24, padding: 24, background: "white", border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <strong>API integration ready</strong>
        <p style={{ color: "#64748b" }}>The UI is intentionally not using mock project records. The next step is wiring the authenticated project query to the deployed project function.</p>
      </div>
    </main>
  );
}
