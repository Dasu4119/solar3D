import type { Point2D } from "@/features/design/types";

export interface DesignContextModule { id: string; manufacturer: string; model: string; widthM: number; lengthM: number; powerWatts: number; efficiency: number; }
export interface DesignContextSetback { northM: number; eastM: number; southM: number; westM: number; }
export interface DesignContext { designId: string; designVersionId: string | null; roofId: string | null; roof: Point2D[]; roofAreaM2: number | null; module: DesignContextModule; setback: DesignContextSetback; }
export interface DesignContextApiResponse {
  success?: boolean; error?: string; design?: { id?: string; active_version_id?: string | null } | null; active_version?: { id?: string | null } | null;
  roofs?: Array<{ id?: string; geometry?: unknown; area_m2?: number | null }>;
  module?: { id?: string; manufacturer?: string; model?: string; widthM?: number; lengthM?: number; powerWatts?: number; efficiency?: number } | null;
  defaults?: { setback?: Partial<DesignContextSetback> } | null;
  layout?: { roof_id?: string | null; module_id?: string | null; setback_m?: number | null; setback_north_m?: number | null; setback_east_m?: number | null; setback_south_m?: number | null; setback_west_m?: number | null } | null;
}

function geometryToPoints(geometry: unknown): Point2D[] {
  if (Array.isArray(geometry)) return geometry.filter((point): point is Point2D => {
    if (!point || typeof point !== "object") return false;
    const value = point as Record<string, unknown>;
    return typeof value.x === "number" && typeof value.y === "number";
  });
  if (geometry && typeof geometry === "object") {
    const value = geometry as Record<string, unknown>;
    if (Array.isArray(value.mesh)) return geometryToPoints(value.mesh);
    if (Array.isArray(value.coordinates) && Array.isArray(value.coordinates[0])) {
      const ring = value.coordinates[0];
      if (Array.isArray(ring)) return (ring as unknown[]).flatMap((point) => {
        if (!Array.isArray(point) || point.length < 2 || typeof point[0] !== "number" || typeof point[1] !== "number") return [];
        return [{ x: point[0], y: point[1] }];
      });
    }
  }
  return [];
}

export function mapDesignContext(response: DesignContextApiResponse): DesignContext {
  if (!response.success || !response.design?.id || !response.module?.id) throw new Error(response.error ?? "Design context is not configured");
  const selectedRoof = response.layout?.roof_id
    ? response.roofs?.find((roof) => roof.id === response.layout?.roof_id)
    : response.roofs?.[0];
  const points = geometryToPoints(selectedRoof?.geometry);
  if (points.length < 3) throw new Error("Selected project roof geometry is missing or invalid");

  const defaults = response.defaults?.setback ?? {};
  const uniformSetback = typeof response.layout?.setback_m === "number" ? response.layout.setback_m : null;
  const setback = {
    northM: response.layout?.setback_north_m ?? uniformSetback ?? defaults.northM ?? 0,
    eastM: response.layout?.setback_east_m ?? uniformSetback ?? defaults.eastM ?? 0,
    southM: response.layout?.setback_south_m ?? uniformSetback ?? defaults.southM ?? 0,
    westM: response.layout?.setback_west_m ?? uniformSetback ?? defaults.westM ?? 0,
  };
  const module = response.module;
  return {
    designId: response.design.id,
    designVersionId: response.active_version?.id ?? response.design.active_version_id ?? null,
    roofId: response.layout?.roof_id ?? selectedRoof?.id ?? null,
    roof: points,
    roofAreaM2: selectedRoof?.area_m2 ?? null,
    module: { id: module.id!, manufacturer: module.manufacturer ?? "", model: module.model ?? "", widthM: Number(module.widthM ?? 0), lengthM: Number(module.lengthM ?? 0), powerWatts: Number(module.powerWatts ?? 0), efficiency: Number(module.efficiency ?? 0) },
    setback,
  };
}
