import Link from "next/link";
import { DesignWorkspace } from "@/features/design/DesignWorkspace";

export default async function DesignPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <>
      <div style={{ position: "absolute", zIndex: 20, top: 14, left: 120 }}>
        <Link href={`/projects/${projectId}/overview`} style={{ fontSize: 13 }}>← Project</Link>
      </div>
      <DesignWorkspace projectId={projectId} />
    </>
  );
}
