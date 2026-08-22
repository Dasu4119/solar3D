import { describe, expect, it } from "vitest";
import { mapDesignContext } from "./design-context";

describe("mapDesignContext", () => {
  const base = {
    success: true,
    design: { id: "design-1", active_version_id: "version-1" },
    active_version: { id: "version-1" },
    module: { id: "module-1", manufacturer: "Solar3D", model: "400W", widthM: 1, lengthM: 2, powerWatts: 400, efficiency: 0.2 },
    defaults: { setback: { northM: 0.3, eastM: 0.4, southM: 0.5, westM: 0.6 } },
  };

  it("uses the roof selected by the layout instead of array position", () => {
    const result = mapDesignContext({
      ...base,
      roofs: [
        { id: "roof-a", area_m2: 20, geometry: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] },
        { id: "roof-b", area_m2: 35, geometry: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }] },
      ],
      layout: { roof_id: "roof-b", module_id: "module-1" },
    });

    expect(result.roofId).toBe("roof-b");
    expect(result.roofAreaM2).toBe(35);
    expect(result.roof).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]);
  });

  it("preserves directional layout setbacks over the legacy uniform value and defaults", () => {
    const result = mapDesignContext({
      ...base,
      roofs: [{ id: "roof-a", area_m2: 20, geometry: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] }],
      layout: {
        roof_id: "roof-a",
        module_id: "module-1",
        setback_m: 1,
        setback_north_m: 0.2,
        setback_east_m: 0.4,
        setback_south_m: 0.6,
        setback_west_m: 0.8,
      },
    });

    expect(result.setback).toEqual({ northM: 0.2, eastM: 0.4, southM: 0.6, westM: 0.8 });
  });
});
