import Link from "next/link";
import { DesignWorkspace } from "@/features/design/DesignWorkspace";

export default async function DesignPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <>
      <div style={{ position: "absolute", zIndex: 20, top: 14, left: 120, display: "flex", gap: 18 }}>
        <Link href={`/projects/${projectId}/overview`} style={{ fontSize: 13 }}>← Project</Link>
        <Link href={`/projects/${projectId}/mapping`} style={{ fontSize: 13 }}>Open 3D Site Mapping ↗</Link>
      </div>
      <DesignWorkspace projectId={projectId} />
    </>
  );
}
