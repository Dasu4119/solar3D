"use client";

import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/shared/api/project.api";

export function useProjects(organizationId?: string) {
  return useQuery({
    queryKey: ["projects", organizationId ?? "current"],
    queryFn: () => listProjects(organizationId ? { organizationId } : {}),
  });
}
