import { describe, expect, it } from "vitest";
import { calculateRoofUtilization } from "./ProductionDashboard";

describe("ProductionDashboard metrics", () => {
  it("calculates and clamps roof utilization", () => {
    expect(calculateRoofUtilization(60, 45)).toBe(75);
    expect(calculateRoofUtilization(60, 90)).toBe(100);
    expect(calculateRoofUtilization(60, -5)).toBe(0);
  });

  it("handles invalid roof area safely", () => {
    expect(calculateRoofUtilization(0, 10)).toBe(0);
    expect(calculateRoofUtilization(Number.NaN, 10)).toBe(0);
  });
});
