"use client";

import { useEffect, useRef, useState } from "react";
import { screenToWorld, zoomAt, type Viewport } from "@/engine/cad/canvas";
import { snapPointToGrid, type GridConfig } from "@/engine/cad/grid";
import { nearestVertex } from "@/engine/cad/selection";
import { polygonArea } from "@/engine/cad/measure";
import { commitHistory, createHistory, redo, undo, type HistoryState } from "@/engine/cad/history";
import type { CadTool } from "@/engine/cad/tools";
import { moveVertex } from "@/engine/cad/roof";
import type { Point } from "@/engine/geometry/point";

interface CadCanvasProps {
  roof?: Point[];
  tool?: CadTool;
  onRoofChange?: (points: Point[]) => void;
}

const initialViewport: Viewport = { zoom: 1, panX: 0, panY: 0 };
const grid: GridConfig = { size: 10, enabled: true };
const HIT_TOLERANCE = 10;

export function CadCanvas({ roof = [], tool = "roof", onRoofChange }: CadCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState(initialViewport);
  const [draft, setDraft] = useState<Point[]>(roof);
  const historyRef = useRef<HistoryState<Point[]>>(createHistory(roof));
  const [historyVersion, setHistoryVersion] = useState(0);
  const [panActive, setPanActive] = useState(false);
  const [selectedVertex, setSelectedVertex] = useState(-1);
  const dragVertex = useRef(false);
  const dragStart = useRef<Point[] | null>(null);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setDraft(roof);
    historyRef.current = createHistory(roof);
    setHistoryVersion((v) => v + 1);
  }, [roof]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    const step = grid.size;
    const left = -viewport.panX / viewport.zoom;
    const top = -viewport.panY / viewport.zoom;
    const right = (width - viewport.panX) / viewport.zoom;
    const bottom = (height - viewport.panY) / viewport.zoom;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1 / viewport.zoom;
    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }

    if (draft.length) {
      ctx.beginPath();
      draft.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      if (draft.length > 2) ctx.closePath();
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 2 / viewport.zoom;
      ctx.stroke();
      if (draft.length > 2) {
        ctx.fillStyle = "rgba(15, 118, 110, 0.10)";
        ctx.fill();
      }
      draft.forEach((p, index) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, (index === selectedVertex ? 6 : 4) / viewport.zoom, 0, Math.PI * 2);
        ctx.fillStyle = index === selectedVertex ? "#b45309" : "#0f766e";
        ctx.fill();
      });
    }
    ctx.restore();
  }, [draft, selectedVertex, viewport, historyVersion]);

  function pointerPosition(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return screenToWorld({ x: e.clientX, y: e.clientY }, viewport, { left: rect.left, top: rect.top });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const point = pointerPosition(e);
    const shouldPan = tool === "pan" || e.button === 1 || e.shiftKey;
    if (shouldPan) {
      setPanActive(true);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    if (tool === "select") {
      const index = nearestVertex(draft, point, HIT_TOLERANCE / viewport.zoom);
      setSelectedVertex(index);
      dragVertex.current = index >= 0;
      dragStart.current = index >= 0 ? draft.map((p) => ({ ...p })) : null;
      if (dragVertex.current) e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "roof") {
      const next = [...draft, snapPointToGrid(point, grid)];
      setDraft(next);
      historyRef.current = commitHistory(historyRef.current, next);
      setHistoryVersion((v) => v + 1);
      onRoofChange?.(next);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (panActive) {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setViewport((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
      return;
    }
    if (!dragVertex.current || selectedVertex < 0 || tool !== "select") return;
    const point = snapPointToGrid(pointerPosition(e), grid);
    const next = moveVertex(draft, selectedVertex, point);
    setDraft(next);
    onRoofChange?.(next);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragVertex.current && dragStart.current) {
      historyRef.current = commitHistory(historyRef.current, draft);
      setHistoryVersion((v) => v + 1);
    }
    dragStart.current = null;
    setPanActive(false);
    dragVertex.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === "z") {
      e.preventDefault();
      const next = undo(historyRef.current);
      if (next !== historyRef.current) {
        historyRef.current = next;
        setDraft(next.present);
        onRoofChange?.(next.present);
        setHistoryVersion((v) => v + 1);
      }
    } else if (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z")) {
      e.preventDefault();
      const next = redo(historyRef.current);
      if (next !== historyRef.current) {
        historyRef.current = next;
        setDraft(next.present);
        onRoofChange?.(next.present);
        setHistoryVersion((v) => v + 1);
      }
    }
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setViewport((v) => zoomAt(v, e.deltaY > 0 ? 0.9 : 1.1, anchor));
  }

  const area = polygonArea(draft);
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} tabIndex={0} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={handleWheel} style={{ width: "100%", height: "100%", display: "block", cursor: panActive ? "grabbing" : tool === "select" ? "default" : "crosshair", touchAction: "none", outline: "none" }} aria-label="Solar CAD canvas" />
      {draft.length >= 3 && (
        <div style={{ position: "absolute", top: 12, right: 12, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.92)", border: "1px solid #e5e7eb", fontSize: 12 }}>
          Roof area: <strong>{area.toFixed(2)} m²</strong>
          <div style={{ marginTop: 4, opacity: 0.65 }}>Undo {canUndo ? "available" : "empty"} · Redo {canRedo ? "available" : "empty"}</div>
        </div>
      )}
    </div>
  );
}
