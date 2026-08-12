"use client";

import { useQuery } from "@tanstack/react-query";
import { listProjects, getProject, listProjectSites } from "@/shared/api/project.api";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
}

export function useProject(projectId: string) {
  return useQuery({ queryKey: ["project", projectId], queryFn: () => getProject({ projectId }), enabled: Boolean(projectId) });
}

export function useProjectSites(projectId: string) {
  return useQuery({ queryKey: ["project", projectId, "sites"], queryFn: () => listProjectSites({ projectId }), enabled: Boolean(projectId) });
}
