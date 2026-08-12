import { invokeFunction } from "@/shared/api/client";

export interface EngineeringRequest { designVersionId: string; }
export interface EngineeringResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  strings?: unknown[];
}

export function validateEngineering(body: EngineeringRequest) {
  return invokeFunction<EngineeringResult>("solar-engineering", body);
}
