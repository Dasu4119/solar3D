import { invokeFunction } from "@/shared/api/client";

export interface FinancialsRequest { designVersionId: string; }
export interface FinancialsResult {
  capex: number;
  annualSavings: number;
  paybackYears: number;
  npv?: number;
  irr?: number;
}

export function calculateFinancials(body: FinancialsRequest) {
  return invokeFunction<FinancialsResult>("solar-financials", body);
}
