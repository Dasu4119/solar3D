/**
 * Canonical precision policy for engineering energy values.
 *
 * Calculations retain full IEEE-754 precision internally. These helpers are
 * only for presentation, regression comparison, and future canonical
 * serialization so insignificant floating-point noise does not become a
 * product-level difference.
 */

export const ENERGY_DISPLAY_DECIMALS = 2;
export const ENERGY_REGRESSION_TOLERANCE_KWH = 0.01;

export function roundEngineeringEnergyKwh(value: number): number {
  const factor = 10 ** ENERGY_DISPLAY_DECIMALS;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function engineeringEnergyEqual(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= ENERGY_REGRESSION_TOLERANCE_KWH;
}
