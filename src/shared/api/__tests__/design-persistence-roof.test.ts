import { describe, expect, it } from "vitest";
import { decodeRoofGeometry, encodeRoofGeometry } from "@/shared/api/design-persistence";
import type { RoofPlane } from "@/engine/roof/plane-extraction";

describe("roof persistence codec", () => {
  const mesh = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }];
  const planes: RoofPlane[] = [{
    id: "roof-plane-1",
    triangleIndices: [0, 1],
    vertexIndices: [0, 1, 2],
    normal: { x: 0, y: 0, z: 1 },
    pitchDeg: 0,
    azimuthDeg: 0,
    areaM2: 8,
    centroid: { x: 2, y: 1, z: 0 },
  }];

  it("round-trips the canonical roof model", () => {
    const persisted = encodeRoofGeometry(mesh, planes);
    expect(persisted.schemaVersion).toBe(1);
    expect(decodeRoofGeometry(persisted)).toEqual({ mesh, roofPlanes: planes });
  });

  it("keeps legacy point-array roofs readable", () => {
    expect(decodeRoofGeometry(mesh)).toEqual({ mesh, roofPlanes: [] });
  });
});
