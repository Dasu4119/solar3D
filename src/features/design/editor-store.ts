import { create } from "zustand";
import type { DesignEditorState, DesignTool } from "./types";

interface DesignActions {
  setTool: (tool: DesignTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  clearSelection: () => void;
  select: (id: string, additive?: boolean) => void;
}

const initialState: DesignEditorState = {
  activeTool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  selectedIds: [],
  roofs: [],
  panels: [],
  obstacles: [],
};

export const useDesignEditorStore = create<DesignEditorState & DesignActions>((set) => ({
  ...initialState,
  setTool: (activeTool) => set({ activeTool }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
  setPan: (x, y) => set({ pan: { x, y } }),
  clearSelection: () => set({ selectedIds: [] }),
  select: (id, additive = false) => set((state) => ({ selectedIds: additive ? [...new Set([...state.selectedIds, id])] : [id] })),
}));
