import type { PanelPlacement } from "@/engine/solar/placement";
import type { SolarPanelSpec } from "@/engine/solar/panel";
import type { RoofPlane } from "@/engine/solar/layout/roof-planes";
import { estimatePanelIrradiance, type IrradianceModel, type PanelIrradianceResult } from "./irradiance";
import { calculateShadeFractions, type OcclusionOptions, type RoofObstaclePrism } from "./occlusion";
import { solarPosition, type SolarPositionInput } from "./solar-position";

export interface SolarProductionRequest extends SolarPositionInput {
  panel: SolarPanelSpec;
  placements: PanelPlacement[];
  roofPlanes: RoofPlane[];
  /** Explicit mapping is required for multi-plane layouts because PanelPlacement is intentionally geometry-only. */
  placementRoofPlaneIds?: Record<string, string>;
  obstacles?: RoofObstaclePrism[];
  irradiance?: IrradianceModel;
  occlusion?: OcclusionOptions;
}

export interface PanelProductionResult extends PanelIrradianceResult {
  placementId: string;
  roofPlaneId?: string;
}

export interface SolarProductionResult {
  solarPosition: ReturnType<typeof solarPosition>;
  panels: PanelProductionResult[];
  totalDcPowerWatts: number;
  unshadedDcPowerWatts: number;
  averageShadeFraction: number;
}

/**
 * Connects the P1-D physics layers without changing panel placement constraints:
 * solar position -> 3D occlusion -> plane-of-array irradiance -> panel DC power.
 */
export function estimateSolarProduction(request: SolarProductionRequest): SolarProductionResult {
  const sun = solarPosition({ date: request.date, latitudeDeg: request.latitudeDeg, longitudeDeg: request.longitudeDeg });
  const planesById = new Map(request.roofPlanes.map((plane) => [plane.id, plane]));
  const planeForPlacement = (placement: PanelPlacement): RoofPlane | undefined => {
    const planeId = request.placementRoofPlaneIds?.[placement.id];
    return planeId ? planesById.get(planeId) : request.roofPlanes.length === 1 ? request.roofPlanes[0] : undefined;
  };
  const shadeFractions = calculateShadeFractions(
    request.panel,
    request.placements,
    (placementId) => {
      const placement = request.placements.find((candidate) => candidate.id === placementId);
      return placement ? planeForPlacement(placement) : undefined;
    },
    sun.vectorENU,
    request.obstacles ?? [],
    request.occlusion,
  );

  const panels = request.placements.map((placement) => {
    const plane = planeForPlacement(placement);
    const shadeFraction = shadeFractions.get(placement.id) ?? 0;
    const result = plane
      ? estimatePanelIrradiance(
          {
            tiltDeg: plane.pitchDeg,
            azimuthDeg: plane.azimuthDeg,
            areaM2: request.panel.widthM * request.panel.lengthM,
            powerWatts: request.panel.powerWatts,
            efficiency: request.panel.efficiency,
          },
          sun,
          request.irradiance,
          { shadeFraction },
        )
      : { irradianceWm2: 0, unshadedIrradianceWm2: 0, shadeFraction, estimatedDcPowerWatts: 0 };

    return {
      placementId: placement.id,
      roofPlaneId: request.placementRoofPlaneIds?.[placement.id],
      ...result,
    };
  });

  const totalDcPowerWatts = panels.reduce((sum, panel) => sum + panel.estimatedDcPowerWatts, 0);
  const unshadedDcPowerWatts = panels.reduce(
    (sum, panel) => sum + Math.min(request.panel.powerWatts, panel.unshadedIrradianceWm2 * request.panel.widthM * request.panel.lengthM * request.panel.efficiency),
    0,
  );
  const averageShadeFraction = panels.length
    ? panels.reduce((sum, panel) => sum + panel.shadeFraction, 0) / panels.length
    : 0;

  return { solarPosition: sun, panels, totalDcPowerWatts, unshadedDcPowerWatts, averageShadeFraction };
}
