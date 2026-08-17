import { describe, expect, it } from "vitest";
import { analyzeRoofPlane, polygonAreaM2, polygonCentroid, sortRoofPlanesByUsableArea, validateRoofPlane } from "../roof-planes";

describe("roof plane intelligence", () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it("calculates area and centroid", () => {
    expect(polygonAreaM2(square)).toBe(100);
    expect(polygonCentroid(square)).toEqual({ x: 5, y: 5 });
  });

  it("normalizes azimuth and exposes plane metadata", () => {
    const analysis = analyzeRoofPlane({ id: "south", polygon: square, pitchDeg: 25, azimuthDeg: -90 });
    expect(analysis.areaM2).toBe(100);
    expect(analysis.azimuthDeg).toBe(270);
    expect(analysis.pitchDeg).toBe(25);
  });

  it("validates physical roof-plane inputs", () => {
    expect(validateRoofPlane({ id: "ok", polygon: square, pitchDeg: 30, azimuthDeg: 180 })).toEqual([]);
    expect(validateRoofPlane({ id: "bad", polygon: square.slice(0, 2), pitchDeg: 95, azimuthDeg: Number.NaN })).toHaveLength(3);
  });

  it("orders planes by area without mutating input", () => {
    const small = { id: "small", polygon: square.slice(0, 3), pitchDeg: 20, azimuthDeg: 90 };
    const large = { id: "large", polygon: square, pitchDeg: 30, azimuthDeg: 180 };
    const input = [small, large];
    expect(sortRoofPlanesByUsableArea(input).map((p) => p.id)).toEqual(["large", "small"]);
    expect(input.map((p) => p.id)).toEqual(["small", "large"]);
  });
});
