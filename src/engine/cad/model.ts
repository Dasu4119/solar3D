import type { Point2D, Polygon2D, Transform2D } from "@/engine/geometry/types";

export type CadTool = "select" | "roof" | "panel" | "obstacle" | "measure";
export type CadEntityKind = "roof" | "panel" | "obstacle";

export interface CadEntity { id: string; kind: CadEntityKind; transform: Transform2D; geometry: Polygon2D; properties: Record<string, string | number | boolean>; }
export interface CadDocument { version: 1; units: "m" | "ft"; gridSize: number; entities: CadEntity[]; selectedIds: string[]; cursor: Point2D | null; }

export const emptyCadDocument = (): CadDocument => ({ version: 1, units: "m", gridSize: 0.25, entities: [], selectedIds: [], cursor: null });
