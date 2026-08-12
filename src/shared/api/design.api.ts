import { invokeFunction } from "@/shared/api/client";
import type { Design, DesignVersion, Roof } from "@/shared/types/domain";

export function getDesign(designId: string) {
  return invokeFunction<Design>("solar-project-api", { action: "design.get", designId });
}

export function getDesignVersions(designId: string) {
  return invokeFunction<DesignVersion[]>("solar-project-api", { action: "design.versions", designId });
}

export function getRoofs(designId: string) {
  return invokeFunction<Roof[]>("solar-project-api", { action: "roof.list", designId });
}
