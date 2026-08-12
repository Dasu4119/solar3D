import { invokeFunction } from "@/shared/api/client";

export interface ProposalRequest { designVersionId: string; }
export interface ProposalResult { id: string; status: string; downloadUrl?: string; }

export function generateProposal(body: ProposalRequest) {
  return invokeFunction<ProposalResult>("solar-proposal", body);
}
