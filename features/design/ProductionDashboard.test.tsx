import { describe, expect, it } from "vitest";
import { calculateRoofUtilization } from "./ProductionDashboard";

describe("ProductionDashboard metrics", () => {
  it("calculates and clamps roof utilization", () => {
    expect(calculateRoofUtilization(60, 45)).toBe(75);
    expect(calculateRoofUtilization(60, 90)).toBe(100);
    expect(calculateRoofUtilization(60, -5)).toBe(0);
  });

  it("returns null when usable roof area is not authoritative", () => {
    expect(calculateRoofUtilization(200, null)).toBeNull();
    expect(calculateRoofUtilization(null, 10)).toBeNull();
  });
});
