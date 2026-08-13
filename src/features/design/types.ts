export type DesignTool = "select" | "roof" | "panel" | "obstacle" | "measure";

export interface Point2D { x: number; y: number; }
export interface RoofPolygon { id: string; points: Point2D[]; }
export interface PanelPlacement { id: string; x: number; y: number; rotation: number; }
export interface Obstacle { id: string; points: Point2D[]; label?: string; }

export interface DesignEditorState {
  activeTool: DesignTool;
  zoom: number;
  pan: Point2D;
  selectedIds: string[];
  roofs: RoofPolygon[];
  panels: PanelPlacement[];
  obstacles: Obstacle[];
}
