"use client";

import { useQuery } from "@tanstack/react-query";
import { getProject, listProjectSites, listProjects } from "@/shared/api/project.api";

export function useProjects(organizationId?: string) {
  return useQuery({
    queryKey: ["projects", organizationId ?? "current"],
    queryFn: () => listProjects(organizationId ? { organizationId } : {}),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject({ projectId }),
    enabled: Boolean(projectId),
  });
}

export function useProjectSites(projectId: string) {
  return useQuery({
    queryKey: ["project-sites", projectId],
    queryFn: () => listProjectSites({ projectId }),
    enabled: Boolean(projectId),
  });
}
