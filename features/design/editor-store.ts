import { create } from "zustand";
import type { DesignEditorState, DesignTool, PanelPlacement } from "./types";

interface DesignActions {
  setTool: (tool: DesignTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  clearSelection: () => void;
  select: (id: string, additive?: boolean) => void;
  addPanel: (panel: PanelPlacement) => void;
  movePanel: (id: string, x: number, y: number) => void;
  rotatePanel: (id: string) => void;
  removePanel: (id: string) => void;
  hydrate: (roof: { id: string; points: { x: number; y: number }[] } | null, panels: PanelPlacement[]) => void;
}

const initialState: DesignEditorState = {
  activeTool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  selectedIds: [],
  roofs: [{ id: "roof-1", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }] }],
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
  addPanel: (panel) => set((state) => ({ panels: [...state.panels, panel], selectedIds: [panel.id] })),
  movePanel: (id, x, y) => set((state) => ({ panels: state.panels.map((panel) => panel.id === id ? { ...panel, x, y } : panel) })),
  rotatePanel: (id) => set((state) => ({ panels: state.panels.map((panel) => panel.id === id ? { ...panel, rotation: (panel.rotation + 90) % 360 } : panel) })),
  removePanel: (id) => set((state) => ({ panels: state.panels.filter((panel) => panel.id !== id), selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id) })),
  hydrate: (roof, panels) => set({ roofs: roof ? [roof] : [], panels, selectedIds: [] }),
}));
