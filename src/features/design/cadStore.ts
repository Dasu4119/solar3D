"use client";

import { create } from "zustand";
import { createHistory, commitHistory, redo, undo, type HistoryState } from "@/engine/cad/history";
import { emptyCadDocument, type CadDocument, type CadTool } from "@/engine/cad/model";

interface CadStore {
  history: HistoryState<CadDocument>;
  activeTool: CadTool;
  setTool: (tool: CadTool) => void;
  update: (next: CadDocument) => void;
  undo: () => void;
  redo: () => void;
}

export const useCadStore = create<CadStore>((set) => ({
  history: createHistory(emptyCadDocument()),
  activeTool: "select",
  setTool: (activeTool) => set({ activeTool }),
  update: (next) => set((state) => ({ history: commitHistory(state.history, next) })),
  undo: () => set((state) => ({ history: undo(state.history) })),
  redo: () => set((state) => ({ history: redo(state.history) })),
}));
