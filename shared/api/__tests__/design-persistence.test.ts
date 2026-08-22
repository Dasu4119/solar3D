import { describe, expect, it } from "vitest";
import type { Point } from "@/engine/geometry/point";
import type { ProjectApiInvoker } from "@/shared/api/design-persistence";
import { createDesignPersistence } from "@/shared/api/design-persistence";

const roof: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 0, y: 5 },
];

function invoker(handler: (action: string, body: Record<string, unknown>) => unknown): ProjectApiInvoker {
  return { invoke: async <T>(action: string, body: Record<string, unknown>) => handler(action, body) as T };
}

describe("design persistence API adapter", () => {
  it("loads the active version and maps persisted placements", async () => {
    const api = invoker((action) => {
      expect(action).toBe("get_design");
      return {
        success: true,
        active_version: { id: "version-1", metrics: { panel_count: 2 } },
        roofs: [{ id: "roof-1", area_m2: 200, geometry: roof }],
        panel_placements: [
          { id: "p1", x: 2, y: 2, z: 0, rotation_degrees: 0 },
          { id: "p2", x: 4, y: 2, z: 0, rotation_degrees: 90 },
        ],
      };
    });

    const snapshot = await createDesignPersistence(api).load("design-1");
    expect(snapshot?.versionId).toBe("version-1");
    expect(snapshot?.roofId).toBe("roof-1");
    expect(snapshot?.roofAreaM2).toBe(200);
    expect(snapshot?.roof).toEqual(roof);
    expect(snapshot?.panelPlacements).toHaveLength(2);
    expect(snapshot?.panelPlacements[1].center).toEqual({ x: 4, y: 2 });
    expect(snapshot?.panelPlacements[1].rotation).toBe(90);
  });

  it("saves a new version through save_design with canonical module metadata", async () => {
    const api = invoker((action, body) => {
      expect(action).toBe("save_design");
      expect(body.design_id).toBe("design-1");
      expect(body.module_id).toBe("module-1");
      expect(body.setback_m).toBe(0.3);
      expect(body.dc_capacity_kw).toBe(0.4);
      expect((body.roof as Record<string, unknown>).id).toBe("roof-1");
      expect(body.panel_placements).toHaveLength(1);
      return { success: true, design_version: { id: "version-2" } };
    });

    const snapshot = await createDesignPersistence(api).save({
      designId: "design-1",
      roof,
      roofId: "roof-1",
      roofAreaM2: 200,
      moduleId: "module-1",
      setbackM: 0.3,
      panelPlacements: [{ id: "p1", panelId: "module-1", center: { x: 2, y: 2 }, rotation: 0 }],
      metrics: { dc_capacity_kw: 0.4 },
    });

    expect(snapshot.versionId).toBe("version-2");
  });
});
