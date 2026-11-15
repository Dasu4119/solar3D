import { SiteMappingWorkspace } from "@/features/mapping/SiteMappingWorkspace";

export default async function MappingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <SiteMappingWorkspace projectId={projectId} />;
}
