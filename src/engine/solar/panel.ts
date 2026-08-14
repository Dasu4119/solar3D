export interface SolarPanelSpec {
  id: string;
  manufacturer: string;
  model: string;
  widthM: number;
  lengthM: number;
  powerWatts: number;
  efficiency: number;
  temperatureCoefficientPmaxPctPerC?: number;
  bifacial?: boolean;
}

export function panelArea(panel: SolarPanelSpec): number {
  return panel.widthM * panel.lengthM;
}

export function panelPowerKw(panel: SolarPanelSpec): number {
  return panel.powerWatts / 1000;
}

export function validatePanelSpec(panel: SolarPanelSpec): void {
  if (!panel.id.trim()) throw new Error("Panel id is required");
  if (!panel.manufacturer.trim()) throw new Error("Panel manufacturer is required");
  if (!panel.model.trim()) throw new Error("Panel model is required");
  if (!(panel.widthM > 0) || !(panel.lengthM > 0)) throw new Error("Panel dimensions must be positive");
  if (!(panel.powerWatts > 0)) throw new Error("Panel power must be positive");
  if (!(panel.efficiency > 0 && panel.efficiency <= 1)) throw new Error("Panel efficiency must be between 0 and 1");
}
