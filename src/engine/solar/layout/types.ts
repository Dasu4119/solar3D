import type { Point } from "@/engine/geometry/point";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { PanelPlacement } from "@/engine/solar/placement";
import type { UsableRoofRegion } from "@/engine/geometry/roof-constraints";
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

export interface LayoutProductionObjective {
  /** Reference site-specific yield; the annual production engine supplies the calculation. */
  annualSpecificYieldKwhPerKwp?: number;
  performanceRatio?: number;
  shadedEnergyFraction?: number;
  /** Optional preferred panel azimuth used to distinguish otherwise equivalent rotations. */
  preferredAzimuthDeg?: number;
  /** Optional preferred roof pitch used to distinguish otherwise equivalent roof planes. */
  preferredPitchDeg?: number;
}

export interface LayoutFinancialObjective {
  /** Installed system cost used for NPV/payback ranking. */
  systemCostUsd?: number;
  /** Optional variable installed cost; multiplied by candidate DC watts. */
  systemCostUsdPerWatt?: number;
  electricityRateUsdPerKwh: number;
  annualOpexUsd?: number;
  incentiveUsd?: number;
  annualDegradationRate?: number;
  analysisYears?: number;
  discountRate?: number;
}

export interface LayoutRequest {
  roof: Point[];
  roofRegions?: LayoutRoofRegion[];
  /** Canonical P1-B physical constraint output. Prefer this over legacy holes/obstacles. */
  usableRoofRegions?: UsableRoofRegion[];
  roofPlanes?: RoofPlane[];
  panel: SolarPanelSpec;
  constraints?: LayoutConstraints;
  productionObjective?: LayoutProductionObjective;
  financialObjective?: LayoutFinancialObjective;
  existingPlacements?: PanelPlacement[];
}

export interface LayoutCandidate {
  placement: PanelPlacement;
  valid: boolean;
  score: number;
  blockedByObstacleId?: string;
  roofPlaneId?: string;
  regionKey?: string;
}

export interface SolarLayoutResult {
  placements: PanelPlacement[];
  candidateCount: number;
  dcCapacityWatts: number;
  score: number;
  estimatedAnnualKwh?: number;
  estimatedNpvUsd?: number;
  estimatedPaybackYears?: number;
  planeSummaries?: Array<{
    roofPlaneId: string;
    pitchDeg: number;
    azimuthDeg: number;
    placementCount: number;
    dcCapacityWatts: number;
    estimatedAnnualKwh?: number;
  }>;
}
