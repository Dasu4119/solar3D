import type { CadDocument } from "@/engine/cad/persistence";
import type { CadPersistenceAdapter } from "@/engine/cad/persistence-adapter";

/**
 * Deterministic in-memory adapter for local development and unit/integration tests.
 * It deliberately does not masquerade as database persistence.
 */
export class MemoryCadPersistenceAdapter implements CadPersistenceAdapter {
  private readonly documents = new Map<string, CadDocument>();

  async load(projectId: string): Promise<CadDocument | null> {
    const document = this.documents.get(projectId);
    return document ? cloneDocument(document) : null;
  }

  async save(projectId: string, document: CadDocument): Promise<void> {
    this.documents.set(projectId, cloneDocument(document));
  }
}

function cloneDocument(document: CadDocument): CadDocument {
  return {
    ...document,
    roof: document.roof.map(({ x, y }) => ({ x, y })),
  };
}
