import { invokeFunction } from "@/shared/api/client";

export interface GenerateLayoutInput {
  designVersionId: string;
  roofId: string;
  moduleId: string;
  setbackM?: number;
  rowSpacingM?: number;
  orientation?: "auto" | "portrait" | "landscape";
}

export interface GenerateLayoutResponse {
  panelCount: number;
  dcCapacityKw: number;
  roofCoveragePercent: number;
  placements: Array<Record<string, unknown>>;
  warnings: string[];
}

export function generateLayout(input: GenerateLayoutInput) {
  return invokeFunction<GenerateLayoutResponse>("solar-auto-layout", input);
}
