import { validatePanelSpec, type SolarPanelSpec } from "@/engine/solar/panel";

export class PanelCatalog {
  private readonly panels = new Map<string, SolarPanelSpec>();

  constructor(initial: SolarPanelSpec[] = []) {
    initial.forEach((panel) => this.register(panel));
  }

  register(panel: SolarPanelSpec): void {
    validatePanelSpec(panel);
    if (this.panels.has(panel.id)) throw new Error(`Panel already exists: ${panel.id}`);
    this.panels.set(panel.id, { ...panel });
  }

  get(id: string): SolarPanelSpec | undefined {
    const panel = this.panels.get(id);
    return panel ? { ...panel } : undefined;
  }

  list(): SolarPanelSpec[] {
    return Array.from(this.panels.values(), (panel) => ({ ...panel }));
  }

  remove(id: string): boolean {
    return this.panels.delete(id);
  }
}
