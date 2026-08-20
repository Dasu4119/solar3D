import { describe, expect, it } from "vitest";
import { buildUsableRoofRegion } from "@/engine/geometry/roof-constraints";
import { extractRoofPlanes } from "@/engine/roof/plane-extraction";
import { generateLayoutCandidates } from "@/engine/solar/layout/generator";
import { calculateAnnualProduction } from "@/engine/solar/production/annual-production";
import { engineeringEnergyEqual } from "@/engine/solar/precision/engineering-precision";
import { ApiDesignPersistence, type DesignPersistenceSnapshot } from "@/shared/api/design-persistence";
import { P1C_LAYOUT_OBSTACLES, P1C_PANEL, P1C_PRODUCTION_INPUT, P1C_ROOF_MESH, P1C_ROOF_REGIONS, P1C_OBSTACLES } from "./p1c-acceptance";

describe("P1-C end-to-end 3D-to-production acceptance", () => {
  it("keeps the complete deterministic pipeline coherent", async () => {
    const planes = extractRoofPlanes(P1C_ROOF_MESH, { minAreaM2: 1 });

    expect(planes).toHaveLength(2);
    expect(planes.map((plane) => plane.id)).toEqual(["roof-plane-1", "roof-plane-2"]);
    expect(planes.every((plane) => plane.pitchDeg > 0 && plane.pitchDeg < 30)).toBe(true);
    expect(planes.every((plane) => plane.azimuthDeg >= 0 && plane.azimuthDeg < 360)).toBe(true);

    const leftRegion = buildUsableRoofRegion([...P1C_ROOF_REGIONS[0]], [], { edgeM: 0.5 });
    const rightRegion = buildUsableRoofRegion([...P1C_ROOF_REGIONS[1]], P1C_OBSTACLES, {
      edgeM: 0.5,
      obstacleClearanceM: 0.75,
    });

    const leftCandidates = generateLayoutCandidates(leftRegion.roof, P1C_PANEL, {
      allowedRotations: [0, 90],
    }, [], undefined, undefined, [leftRegion]);
    const rightCandidates = generateLayoutCandidates(P1C_ROOF_REGIONS[1], P1C_PANEL, {
      allowedRotations: [0, 90],
      obstacles: P1C_LAYOUT_OBSTACLES,
    }, [], [{ outer: P1C_ROOF_REGIONS[1] }], undefined, [rightRegion]);

    const validPlacements = [...leftCandidates, ...rightCandidates]
      .filter((candidate) => candidate.valid)
      .map((candidate) => candidate.placement);

    expect(leftCandidates.length).toBeGreaterThan(0);
    expect(rightCandidates.length).toBeGreaterThan(0);
    expect(validPlacements.length).toBeGreaterThan(0);
    expect(rightCandidates.some((candidate) => candidate.blockedByObstacleId === "p1c-chimney")).toBe(true);

    const production = calculateAnnualProduction({
      panelCount: validPlacements.length,
      panelPowerWatts: P1C_PANEL.powerWatts,
      ...P1C_PRODUCTION_INPUT,
    });

    expect(production.dcCapacityKwp).toBe(validPlacements.length * 0.4);
    expect(production.annualKwh).toBeGreaterThan(0);
    expect(production.monthlyKwh).toHaveLength(12);
    expect(production.shadingLossPct).toBe(5);
    expect(production.warnings).toEqual([]);

    const persisted = new Map<string, DesignPersistenceSnapshot>();
    const persistence = new ApiDesignPersistence({
      async invoke(action, body) {
        if (action === "save_design") {
          const snapshot = body as unknown as DesignPersistenceSnapshot;
          persisted.set(snapshot.designId, snapshot);
          return { success: true, design_version: { id: "p1c-version-1", metrics: snapshot.metrics } };
        }
        if (action === "get_design") {
          const snapshot = persisted.get(String(body.design_id));
          return snapshot
            ? { success: true, active_version: { id: snapshot.versionId, metrics: snapshot.metrics }, roofs: [{ geometry: snapshot.roof }], panel_placements: snapshot.panelPlacements }
            : { success: false };
        }
        throw new Error(`Unexpected persistence action: ${action}`);
      },
    });

    const snapshot: DesignPersistenceSnapshot = {
      designId: "p1c-design",
      roof: [...P1C_ROOF_REGIONS[0]],
      panelPlacements: validPlacements,
      metrics: {
        panel_count: validPlacements.length,
        dc_capacity_kw: production.dcCapacityKwp,
        annual_kwh: production.annualKwh,
        monthly_kwh: production.monthlyKwh,
        shading_loss_pct: production.shadingLossPct,
        warnings: production.warnings,
      },
    };

    const saved = await persistence.save(snapshot);
    const loaded = await persistence.load(saved.designId);

    expect(loaded).not.toBeNull();
    expect(loaded?.panelPlacements).toHaveLength(validPlacements.length);
    expect(loaded?.metrics?.annual_kwh).toBe(production.annualKwh);
    expect(engineeringEnergyEqual(Number(loaded?.metrics?.annual_kwh), production.annualKwh)).toBe(true);
  });

  it("surfaces reference-estimate warnings when site/weather data is missing", () => {
    const result = calculateAnnualProduction({ panelCount: 20, panelPowerWatts: 400 });
    expect(result.annualKwh).toBeGreaterThan(0);
    expect(result.warnings).toContain("Using reference specific yield; replace with site/weather data for a bankable estimate");
    expect(result.warnings).toContain("No shading simulation supplied");
  });
});
