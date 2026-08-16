import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";

export interface LayoutConstraints {
  setbackM?: number;
  panelGapM?: number;
  edgeGapM?: number;
  allowedRotations?: number[];
}

export interface LayoutRequest {
  roof: Point[];
  panel: SolarPanelSpec;
  constraints?: LayoutConstraints;
  existingPlacements?: PanelPlacement[];
}

export interface LayoutCandidate {
  placement: PanelPlacement;
  valid: boolean;
  score: number;
}

export interface SolarLayoutResult {
  placements: PanelPlacement[];
  candidateCount: number;
  dcCapacityWatts: number;
  score: number;
}
