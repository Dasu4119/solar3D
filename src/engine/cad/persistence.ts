import type { Point } from "@/engine/geometry/point";

export const CAD_DOCUMENT_VERSION = 1 as const;

export interface CadDocument {
  version: typeof CAD_DOCUMENT_VERSION;
  units: "metric";
  roof: Point[];
  updatedAt: string;
}

export function createCadDocument(roof: Point[], now = new Date()): CadDocument {
  return {
    version: CAD_DOCUMENT_VERSION,
    units: "metric",
    roof: roof.map((point) => ({ x: point.x, y: point.y })),
    updatedAt: now.toISOString(),
  };
}

export function serializeCadDocument(document: CadDocument): string {
  return JSON.stringify(document);
}

export function parseCadDocument(value: string): CadDocument {
  const parsed: unknown = JSON.parse(value);
  if (!isCadDocument(parsed)) throw new Error("Invalid CAD document");
  return parsed;
}

export function isCadDocument(value: unknown): value is CadDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CadDocument>;
  return candidate.version === CAD_DOCUMENT_VERSION
    && candidate.units === "metric"
    && typeof candidate.updatedAt === "string"
    && Array.isArray(candidate.roof)
    && candidate.roof.every((point) => isPoint(point));
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return typeof point.x === "number" && Number.isFinite(point.x)
    && typeof point.y === "number" && Number.isFinite(point.y);
}
