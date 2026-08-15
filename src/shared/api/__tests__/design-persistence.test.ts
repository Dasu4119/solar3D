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
        roofs: [{ geometry: roof }],
        panel_placements: [
          { id: "p1", x: 2, y: 2, z: 0, rotation_degrees: 0 },
          { id: "p2", x: 4, y: 2, z: 0, rotation_degrees: 90 },
        ],
      };
    });

    const snapshot = await createDesignPersistence(api).load("design-1");
    expect(snapshot?.versionId).toBe("version-1");
    expect(snapshot?.roof).toEqual(roof);
    expect(snapshot?.panelPlacements).toHaveLength(2);
    expect(snapshot?.panelPlacements[1].center).toEqual({ x: 4, y: 2 });
    expect(snapshot?.panelPlacements[1].rotation).toBe(90);
  });

  it("saves a new version through save_design", async () => {
    const api = invoker((action, body) => {
      expect(action).toBe("save_design");
      expect(body.design_id).toBe("design-1");
      expect(body.panel_placements).toHaveLength(1);
      return { success: true, design_version: { id: "version-2" } };
    });

    const snapshot = await createDesignPersistence(api).save({
      designId: "design-1",
      roof,
      panelPlacements: [{ id: "p1", panelId: "module-1", center: { x: 2, y: 2 }, rotation: 0 }],
    });

    expect(snapshot.versionId).toBe("version-2");
  });
});
