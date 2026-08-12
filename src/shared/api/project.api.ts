import { invokeFunction } from "@/shared/api/client";
import type { Project } from "@/shared/types/domain";

export interface ListProjectsRequest { organizationId?: string; }
export interface GetProjectRequest { projectId: string; }

export function listProjects(body: ListProjectsRequest = {}) {
  return invokeFunction<Project[]>("solar-project-api", { action: "list", ...body });
}

export function getProject(body: GetProjectRequest) {
  return invokeFunction<Project>("solar-project-api", { action: "get", ...body });
}
