export function calculateRoofUtilization(
  roofAreaM2: number | null,
  usableRoofAreaM2: number | null | undefined,
): number | null {
  if (
    roofAreaM2 == null ||
    roofAreaM2 <= 0 ||
    usableRoofAreaM2 == null ||
    !Number.isFinite(usableRoofAreaM2)
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, (usableRoofAreaM2 / roofAreaM2) * 100));
}
