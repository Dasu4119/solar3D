import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { RoofPlane } from "./roof-planes";

export interface LayoutObstacle {
  id: string;
  polygon: Point[];
  clearanceM?: number;
}

export interface LayoutRoofRegion {
  outer: Point[];
  holes?: Point[][];
  roofPlaneId?: string;
}

export interface LayoutConstraints {
  setbackM?: number;
  panelGapM?: number;
  edgeGapM?: number;
  allowedRotations?: number[];
  obstacles?: LayoutObstacle[];
}

export interface LayoutRequest {
  roof: Point[];
  roofRegions?: LayoutRoofRegion[];
  roofPlanes?: RoofPlane[];
  panel: SolarPanelSpec;
  constraints?: LayoutConstraints;
  existingPlacements?: PanelPlacement[];
}

export interface LayoutCandidate {
  placement: PanelPlacement;
  valid: boolean;
  score: number;
  blockedByObstacleId?: string;
  roofPlaneId?: string;
}

export interface SolarLayoutResult {
  placements: PanelPlacement[];
  candidateCount: number;
  dcCapacityWatts: number;
  score: number;
  planeSummaries?: Array<{
    roofPlaneId: string;
    pitchDeg: number;
    azimuthDeg: number;
    placementCount: number;
    dcCapacityWatts: number;
  }>;
}
