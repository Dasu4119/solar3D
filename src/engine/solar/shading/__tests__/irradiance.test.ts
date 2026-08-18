import { describe, expect, it } from "vitest";
import { estimatePanelIrradiance } from "../irradiance";
import { solarPosition } from "../solar-position";

describe("solar position", () => {
  it("returns a deterministic daytime position", () => {
    const input = { date: new Date("2026-06-21T12:00:00Z"), latitudeDeg: 40, longitudeDeg: -105 };
    const a = solarPosition(input);
    const b = solarPosition(input);
    expect(a).toEqual(b);
    expect(a.altitudeDeg).toBeGreaterThan(0);
    expect(a.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(a.azimuthDeg).toBeLessThan(360);
  });

  it("returns a unit ENU sun vector", () => {
    const p = solarPosition({ date: new Date("2026-06-21T15:00:00Z"), latitudeDeg: 35, longitudeDeg: -80 });
    const length = Math.hypot(p.vectorENU.east, p.vectorENU.north, p.vectorENU.up);
    expect(length).toBeCloseTo(1, 8);
  });
});

describe("panel irradiance", () => {
  const surface = { tiltDeg: 30, azimuthDeg: 180, areaM2: 2, powerWatts: 400, efficiency: 0.2 };
  const sun = solarPosition({ date: new Date("2026-06-21T17:00:00Z"), latitudeDeg: 35, longitudeDeg: -80 });

  it("increases with direct incidence", () => {
    const result = estimatePanelIrradiance(surface, sun, { directNormalWm2: 1000, diffuseHorizontalWm2: 100 });
    expect(result.unshadedIrradianceWm2).toBeGreaterThan(0);
    expect(result.estimatedDcPowerWatts).toBeGreaterThan(0);
  });

  it("reduces only the direct component under shading", () => {
    const clear = estimatePanelIrradiance(surface, sun, { directNormalWm2: 1000, diffuseHorizontalWm2: 100 }, { shadeFraction: 0 });
    const shaded = estimatePanelIrradiance(surface, sun, { directNormalWm2: 1000, diffuseHorizontalWm2: 100 }, { shadeFraction: 1 });
    expect(shaded.irradianceWm2).toBeLessThan(clear.irradianceWm2);
    expect(shaded.irradianceWm2).toBeGreaterThan(0);
    expect(shaded.estimatedDcPowerWatts).toBeLessThan(clear.estimatedDcPowerWatts);
  });

  it("produces zero irradiance when the sun is below the horizon", () => {
    const night = solarPosition({ date: new Date("2026-06-21T03:00:00Z"), latitudeDeg: 40, longitudeDeg: -105 });
    expect(estimatePanelIrradiance(surface, night).irradianceWm2).toBe(0);
  });
});
