import type { SolarPosition } from "./solar-position";

export interface PanelSurface {
  tiltDeg: number;
  azimuthDeg: number;
  areaM2: number;
  powerWatts: number;
  efficiency: number;
}

export interface IrradianceModel {
  directNormalWm2?: number;
  diffuseHorizontalWm2?: number;
  groundAlbedo?: number;
}

export interface ShadingSample {
  /** 0 = unshaded, 1 = fully shaded. */
  shadeFraction: number;
}

export interface PanelIrradianceResult {
  irradianceWm2: number;
  unshadedIrradianceWm2: number;
  shadeFraction: number;
  estimatedDcPowerWatts: number;
}

const deg = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function panelNormal(surface: PanelSurface): { east: number; north: number; up: number } {
  const tilt = surface.tiltDeg * deg;
  const azimuth = surface.azimuthDeg * deg;
  return {
    east: Math.sin(tilt) * Math.sin(azimuth),
    north: Math.sin(tilt) * Math.cos(azimuth),
    up: Math.cos(tilt),
  };
}

function dot(a: { east: number; north: number; up: number }, b: { east: number; north: number; up: number }): number {
  return a.east * b.east + a.north * b.north + a.up * b.up;
}

/**
 * First-principles plane-of-array estimate. This is intentionally a transparent
 * engineering model; weather, horizon masking and electrical mismatch belong in
 * later layers rather than being hidden inside placement code.
 */
export function estimatePanelIrradiance(
  surface: PanelSurface,
  sun: SolarPosition,
  model: IrradianceModel = {},
  shading: ShadingSample = { shadeFraction: 0 },
): PanelIrradianceResult {
  if (!(surface.areaM2 > 0) || !(surface.powerWatts > 0) || !(surface.efficiency > 0 && surface.efficiency <= 1)) {
    throw new Error("Panel surface has invalid electrical or geometric properties");
  }
  const shadeFraction = clamp(shading.shadeFraction, 0, 1);
  const dni = Math.max(0, model.directNormalWm2 ?? 1000);
  const dhi = Math.max(0, model.diffuseHorizontalWm2 ?? 120);
  const albedo = clamp(model.groundAlbedo ?? 0.2, 0, 1);

  if (sun.altitudeDeg <= 0) {
    return { irradianceWm2: 0, unshadedIrradianceWm2: 0, shadeFraction, estimatedDcPowerWatts: 0 };
  }

  const normal = panelNormal(surface);
  const cosIncidence = Math.max(0, dot(normal, sun.vectorENU));
  const cosZenith = Math.max(1e-6, sun.vectorENU.up);
  const direct = dni * cosIncidence;
  const skyDiffuse = dhi * (1 + Math.cos(surface.tiltDeg * deg)) / 2;
  const groundDiffuse = dhi * albedo * (1 - Math.cos(surface.tiltDeg * deg)) / 2;
  const unshaded = Math.max(0, direct + skyDiffuse + groundDiffuse);
  const irradiance = direct * (1 - shadeFraction) + skyDiffuse + groundDiffuse;

  // Keep the zenith term explicit so future spectral/air-mass models can replace it.
  void cosZenith;

  const estimatedDcPowerWatts = Math.min(surface.powerWatts, irradiance * surface.areaM2 * surface.efficiency);
  return { irradianceWm2: irradiance, unshadedIrradianceWm2: unshaded, shadeFraction, estimatedDcPowerWatts };
}
