export interface SolarPositionInput {
  date: Date;
  latitudeDeg: number;
  longitudeDeg: number;
}

export interface SolarPosition {
  azimuthDeg: number;
  altitudeDeg: number;
  zenithDeg: number;
  vectorENU: { east: number; north: number; up: number };
}

const deg = Math.PI / 180;
const rad = 180 / Math.PI;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic NOAA-style solar position approximation. Azimuth is clockwise from north. */
export function solarPosition(input: SolarPositionInput): SolarPosition {
  if (!Number.isFinite(input.latitudeDeg) || input.latitudeDeg < -90 || input.latitudeDeg > 90) {
    throw new Error("Latitude must be between -90 and 90 degrees");
  }
  if (!Number.isFinite(input.longitudeDeg) || input.longitudeDeg < -180 || input.longitudeDeg > 180) {
    throw new Error("Longitude must be between -180 and 180 degrees");
  }
  const time = input.date.getTime();
  if (!Number.isFinite(time)) throw new Error("Invalid date");

  const d = new Date(time);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((time - start) / 86400000) + 1;
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;

  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

  const solarMinutes = hour * 60 + equationOfTime + 4 * input.longitudeDeg;
  let hourAngleDeg = solarMinutes / 4 - 180;
  hourAngleDeg = ((hourAngleDeg + 540) % 360) - 180;

  const latitude = input.latitudeDeg * deg;
  const hourAngle = hourAngleDeg * deg;
  const sinAltitude = Math.sin(latitude) * Math.sin(decl) + Math.cos(latitude) * Math.cos(decl) * Math.cos(hourAngle);
  const altitude = Math.asin(clamp(sinAltitude, -1, 1));
  const cosAltitude = Math.max(1e-9, Math.cos(altitude));

  const sinAz = -Math.sin(hourAngle) * Math.cos(decl) / cosAltitude;
  const cosAz = (Math.sin(decl) - Math.sin(altitude) * Math.sin(latitude)) / (cosAltitude * Math.cos(latitude));
  const azimuth = Math.atan2(sinAz, cosAz);
  const azimuthDeg = (azimuth * rad + 360) % 360;
  const altitudeDeg = altitude * rad;

  return {
    azimuthDeg,
    altitudeDeg,
    zenithDeg: 90 - altitudeDeg,
    vectorENU: {
      east: Math.cos(altitude) * Math.sin(azimuth),
      north: Math.cos(altitude) * Math.cos(azimuth),
      up: Math.sin(altitude),
    },
  };
}
