import type { Point2D } from "@/features/design/types";
import type { SolarPanelSpec } from "@/src/engine/solar/panel";

export interface DesignContext {
  defaults: {
    roof: Point2D[];
    setback: {
      northM: number;
      eastM: number;
      southM: number;
      westM: number;
    };
  };
  module: SolarPanelSpec;
}

interface DesignContextResponse {
  success?: boolean;
  error?: string;
  defaults?: DesignContext["defaults"];
  module?: SolarPanelSpec;
}

export async function loadDesignContext(invoke: (action: string, body: Record<string, unknown>) => Promise<unknown>): Promise<DesignContext> {
  const response = await invoke("get_design_context", {}) as DesignContextResponse;
  if (!response.success || !response.defaults || !response.module) {
    throw new Error(response.error ?? "Design configuration is unavailable");
  }
  return { defaults: response.defaults, module: response.module };
}
