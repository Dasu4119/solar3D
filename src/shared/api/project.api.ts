import { invokeFunction } from "@/shared/api/client";
import type { Project, Site } from "@/shared/types/domain";

export interface ListProjectsRequest { organizationId?: string; }
export interface GetProjectRequest { projectId: string; }
export interface ListProjectSitesRequest { projectId: string; }

interface ProjectRow { id: string; organization_id: string; customer_id: string | null; name: string; status: string; }
interface SiteRow { id: string; project_id: string; name: string; latitude: number | null; longitude: number | null; }

function mapProject(row: ProjectRow): Project { return { id: row.id, organizationId: row.organization_id, customerId: row.customer_id, name: row.name, status: row.status }; }
function mapSite(row: SiteRow): Site { return { id: row.id, projectId: row.project_id, name: row.name, latitude: row.latitude, longitude: row.longitude }; }

export async function listProjects(body: ListProjectsRequest = {}) {
  const rows = await invokeFunction<ProjectRow[]>("solar-project-api", { action: "list", ...body });
  return rows.map(mapProject);
}
export async function getProject(body: GetProjectRequest) {
  const row = await invokeFunction<ProjectRow>("solar-project-api", { action: "get", ...body });
  return mapProject(row);
}
export async function listProjectSites(body: ListProjectSitesRequest) {
  const rows = await invokeFunction<SiteRow[]>("solar-project-api", { action: "sites", ...body });
  return rows.map(mapSite);
}
