import type { CadDocument } from "@/engine/cad/persistence";

export interface CadPersistenceAdapter {
  load(projectId: string): Promise<CadDocument | null>;
  save(projectId: string, document: CadDocument): Promise<void>;
}

export class ApiCadPersistenceAdapter implements CadPersistenceAdapter {
  constructor(private readonly basePath = "/api/projects") {}

  async load(projectId: string): Promise<CadDocument | null> {
    const response = await fetch(`${this.basePath}/${encodeURIComponent(projectId)}/cad`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CAD load failed (${response.status})`);
    return (await response.json()) as CadDocument;
  }

  async save(projectId: string, document: CadDocument): Promise<void> {
    const response = await fetch(`${this.basePath}/${encodeURIComponent(projectId)}/cad`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(document),
    });
    if (!response.ok) throw new Error(`CAD save failed (${response.status})`);
  }
}
