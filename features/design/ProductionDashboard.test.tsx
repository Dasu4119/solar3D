import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionDashboard } from "./ProductionDashboard";

describe("ProductionDashboard", () => {
  it("renders capacity and roof utilization", () => {
    render(<ProductionDashboard metrics={{ panelCount: 20, dcCapacityKw: 8, roofAreaM2: 60, usableRoofAreaM2: 45 }} />);
    expect(screen.getByText("8.0 kWp")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("Run annual simulation")).toBeTruthy();
  });

  it("renders simulated annual energy and shading loss when supplied", () => {
    render(<ProductionDashboard metrics={{ panelCount: 20, dcCapacityKw: 8, roofAreaM2: 60, usableRoofAreaM2: 45, annualKwh: 11234, shadingLossPct: 7.25 }} />);
    expect(screen.getByText("11,234 kWh")).toBeTruthy();
    expect(screen.getByText("7.3%")).toBeTruthy();
  });
});
