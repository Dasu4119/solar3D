import { request } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}`);
  return value;
}

export default async function globalSetup() {
  const baseURL = required("E2E_BASE_URL");
  const email = required("E2E_ORG_A_EMAIL");
  const password = required("E2E_ORG_A_PASSWORD");
  const bootstrapSecret = required("E2E_SESSION_BOOTSTRAP_SECRET");
  const storageStatePath = required("E2E_STORAGE_STATE");

  await mkdir(path.dirname(storageStatePath), { recursive: true });
  const context = await request.newContext({ baseURL });
  try {
    const response = await context.post("/api/e2e/session", {
      headers: { "x-e2e-bootstrap-secret": bootstrapSecret },
      data: { email, password },
    });
    if (!response.ok()) {
      throw new Error(`Authenticated E2E session bootstrap failed (${response.status()}): ${await response.text()}`);
    }
    await context.storageState({ path: storageStatePath });
  } finally {
    await context.dispose();
  }
}
