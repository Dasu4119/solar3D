export type UUID = string;

export interface Organization { id: UUID; name: string; slug: string; }
export interface Customer { id: UUID; name: string; email: string | null; companyName?: string | null; }
export interface Project { id: UUID; organizationId: UUID; customerId: UUID | null; name: string; status: string; }
export interface Site { id: UUID; projectId: UUID; name: string; latitude: number | null; longitude: number | null; }
export interface Design { id: UUID; projectId: UUID; siteId: UUID; name: string; status: string; }
export interface DesignVersion { id: UUID; designId: UUID; versionNumber: number; name: string; }
export interface Roof { id: UUID; designId: UUID; name: string; areaM2: number; pitchDegrees: number; azimuthDegrees: number; roofType: string; geometry?: unknown; }
export interface ApiError { code: string; message: string; details?: unknown; }
export interface ApiResponse<T> { data: T | null; error: ApiError | null; }
