import { describe, expect, it } from "vitest";
import { mapDesignContext } from "@/shared/api/design-context";

describe("mapDesignContext", () => {
  it("uses persisted project roof and canonical module data", () => {
    const context = mapDesignContext({
      success: true,
      design: { id: "design-1", active_version_id: null },
      roofs: [{ id: "roof-1", area_m2: 200, geometry: { type: "Polygon", coordinates: [[[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]] } }],
      defaults: { setback: { northM: 0.3, eastM: 0.3, southM: 0.3, westM: 0.3 } },
      module: { id: "module-400", manufacturer: "Solar3D", model: "400W Reference", widthM: 1.134, lengthM: 1.722, powerWatts: 400, efficiency: 0.205 },
    });

    expect(context.roof).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }]);
    expect(context.roofAreaM2).toBe(200);
    expect(context.module.model).toBe("400W Reference");
    expect(context.module.powerWatts).toBe(400);
    expect(context.setback).toEqual({ northM: 0.3, eastM: 0.3, southM: 0.3, westM: 0.3 });
  });

  it("prefers persisted layout setback over defaults", () => {
    const context = mapDesignContext({
      success: true,
      design: { id: "design-1" },
      roofs: [{ id: "roof-1", geometry: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] }],
      defaults: { setback: { northM: 0.3, eastM: 0.3, southM: 0.3, westM: 0.3 } },
      layout: { roof_id: "roof-1", setback_m: 0.75 },
      module: { id: "module-1", manufacturer: "Generic", model: "Mono 550W", widthM: 1.134, lengthM: 2.279, powerWatts: 550, efficiency: 0.215 },
    });

    expect(context.setback).toEqual({ northM: 0.75, eastM: 0.75, southM: 0.75, westM: 0.75 });
  });

  it("fails closed when project geometry is missing", () => {
    expect(() => mapDesignContext({ success: true, design: { id: "design-1" }, roofs: [], module: { id: "module-1" } })).toThrow(/roof geometry/i);
  });
});
