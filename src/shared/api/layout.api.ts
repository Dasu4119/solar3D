import { invokeFunction } from "@/shared/api/client";

export interface AutoLayoutRequest {
  designVersionId: string;
  roofId: string;
  moduleId: string;
  setbackM?: number;
  rowSpacingM?: number;
  orientation?: "portrait" | "landscape" | "auto";
}

export interface AutoLayoutResult {
  panelCount: number;
  dcCapacityKw: number;
  roofCoveragePercent: number;
  placements: unknown[];
  warnings: string[];
}

export function generateAutoLayout(body: AutoLayoutRequest) {
  return invokeFunction<AutoLayoutResult>("solar-auto-layout", body);
}
