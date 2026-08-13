"use client";

import { useEffect, useRef, useState } from "react";
import { screenToWorld, zoomAt, type Viewport } from "@/engine/cad/canvas";
import { snapPointToGrid, type GridConfig } from "@/engine/cad/grid";
import type { Point } from "@/engine/geometry/point";

interface CadCanvasProps {
  roof?: Point[];
  onRoofChange?: (points: Point[]) => void;
}

const initialViewport: Viewport = { zoom: 1, panX: 0, panY: 0 };
const grid: GridConfig = { size: 10, enabled: true };

export function CadCanvas({ roof = [], onRoofChange }: CadCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState(initialViewport);
  const [draft, setDraft] = useState<Point[]>(roof);
  const [dragging, setDragging] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setDraft(roof);
  }, [roof]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
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
      ctx.fillStyle = "rgba(15, 118, 110, 0.10)";
      if (draft.length > 2) ctx.fill();
      draft.forEach((p) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 / viewport.zoom, 0, Math.PI * 2);
        ctx.fillStyle = "#0f766e"; ctx.fill();
      });
    }
    ctx.restore();
  }, [draft, viewport]);

  function pointerPosition(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return screenToWorld({ x: e.clientX, y: e.clientY }, viewport, { left: rect.left, top: rect.top });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button === 1 || e.shiftKey) {
      setDragging(true);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const point = snapPointToGrid(pointerPosition(e), grid);
    const next = [...draft, point];
    setDraft(next);
    onRoofChange?.(next);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setViewport((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setViewport((v) => zoomAt(v, e.deltaY > 0 ? 0.9 : 1.1, anchor));
  }

  return <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => setDragging(false)} onWheel={handleWheel} style={{ width: "100%", height: "100%", display: "block", cursor: dragging ? "grabbing" : "crosshair", touchAction: "none" }} aria-label="Solar CAD canvas" />;
}
