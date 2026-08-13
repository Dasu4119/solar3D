export type CadTool = "select" | "roof" | "pan" | "measure";

export interface CadToolState {
  active: CadTool;
  isDrawing: boolean;
}

export const DEFAULT_CAD_TOOL_STATE: CadToolState = {
  active: "select",
  isDrawing: false,
};
