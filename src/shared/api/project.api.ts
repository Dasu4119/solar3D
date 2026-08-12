import { invokeFunction } from "@/shared/api/client";
import type { Project, Site } from "@/shared/types/domain";

export interface ListProjectsRequest { organizationId?: string; }
export interface GetProjectRequest { projectId: string; }
export interface ListProjectSitesRequest { projectId: string; }

export function listProjects(body: ListProjectsRequest = {}) {
  return invokeFunction<Project[]>("solar-project-api", { action: "list", ...body });
}

export function getProject(body: GetProjectRequest) {
  return invokeFunction<Project>("solar-project-api", { action: "get", ...body });
}

export function listProjectSites(body: ListProjectSitesRequest) {
  return invokeFunction<Site[]>("solar-project-api", { action: "sites", ...body });
}
