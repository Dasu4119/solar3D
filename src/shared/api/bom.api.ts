import { invokeFunction } from "@/shared/api/client";

export interface BomRequest { designVersionId: string; }
export interface BomItem { id: string; category: string; name: string; quantity: number; unit?: string; }

export function generateBom(body: BomRequest) {
  return invokeFunction<BomItem[]>("solar-bom", body);
}
