import { describe, expect, it } from "vitest";
import { loadDesignContext } from "./design-context";

describe("loadDesignContext", () => {
  it("maps the canonical backend module and constraints without frontend defaults", async () => {
    const context = await loadDesignContext(async (action) => {
      expect(action).toBe("get_design_context");
      return {
        success: true,
        defaults: {
          roof: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }],
          setback: { northM: 0.3, eastM: 0.3, southM: 0.3, westM: 0.3 },
        },
        module: {
          id: "module-400",
          manufacturer: "Solar3D",
          model: "400W Reference",
          widthM: 1.134,
          lengthM: 1.722,
          powerWatts: 400,
          efficiency: 0.205,
        },
      };
    });

    expect(context.module.id).toBe("module-400");
    expect(context.module.powerWatts).toBe(400);
    expect(context.defaults.setback.northM).toBe(0.3);
    expect(context.defaults.roof).toHaveLength(4);
  });

  it("fails closed when the backend has no canonical configuration", async () => {
    await expect(loadDesignContext(async () => ({ success: false, error: "Design defaults are not configured" }))).rejects.toThrow(
      "Design defaults are not configured",
    );
  });
});
