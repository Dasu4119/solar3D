import { test, expect } from '@playwright/test';

type ResourceIds = Record<string, string>;

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required authenticated E2E secret: ${name}`);
  return value;
};

const resourceIds = (): ResourceIds => {
  const raw = required('E2E_ORG_B_RESOURCE_IDS_JSON');
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('E2E_ORG_B_RESOURCE_IDS_JSON must be a JSON object of table -> row id');
  }
  return parsed as ResourceIds;
};

async function restRequest(baseUrl: string, anonKey: string, token: string, table: string, id: string, method = 'GET', body?: unknown) {
  return fetch(`${baseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test.describe('authenticated organization isolation', () => {
  test('Org A can read its project but cannot read Org B resources', async () => {
    const baseUrl = required('E2E_SUPABASE_URL').replace(/\/$/, '');
    const anonKey = required('E2E_SUPABASE_ANON_KEY');
    const orgAToken = required('E2E_ORG_A_ACCESS_TOKEN');
    const orgAProjectId = required('E2E_ORG_A_PROJECT_ID');
    const orgBProjectId = required('E2E_ORG_B_PROJECT_ID');
    const ids = resourceIds();

    const own = await restRequest(baseUrl, anonKey, orgAToken, 'projects', orgAProjectId);
    expect(own.ok()).toBeTruthy();
    expect(await own.json()).toHaveLength(1);

    const foreignProject = await restRequest(baseUrl, anonKey, orgAToken, 'projects', orgBProjectId);
    expect([200, 401, 403, 404]).toContain(foreignProject.status());
    if (foreignProject.status() === 200) {
      expect(await foreignProject.json()).toEqual([]);
    }

    for (const [table, id] of Object.entries(ids)) {
      const response = await restRequest(baseUrl, anonKey, orgAToken, table, id);
      expect([200, 401, 403, 404]).toContain(response.status());
      if (response.status() === 200) {
        expect(await response.json(), `${table} leaked to Org A`).toEqual([]);
      }
    }
  });

  test('Org A cannot update an Org B project', async () => {
    const baseUrl = required('E2E_SUPABASE_URL').replace(/\/$/, '');
    const anonKey = required('E2E_SUPABASE_ANON_KEY');
    const orgAToken = required('E2E_ORG_A_ACCESS_TOKEN');
    const orgBToken = required('E2E_ORG_B_ACCESS_TOKEN');
    const orgBProjectId = required('E2E_ORG_B_PROJECT_ID');

    const ownerRead = await restRequest(baseUrl, anonKey, orgBToken, 'projects', orgBProjectId);
    expect(ownerRead.ok()).toBeTruthy();
    const ownerRows = await ownerRead.json();
    expect(ownerRows).toHaveLength(1);
    const originalUpdatedAt = ownerRows[0]?.updated_at ?? null;

    const crossOrgUpdate = await restRequest(
      baseUrl,
      anonKey,
      orgAToken,
      'projects',
      orgBProjectId,
      'PATCH',
      { updated_at: originalUpdatedAt },
    );
    expect([401, 403, 404]).toContain(crossOrgUpdate.status());

    const verify = await restRequest(baseUrl, anonKey, orgBToken, 'projects', orgBProjectId);
    expect(verify.ok()).toBeTruthy();
    expect((await verify.json())[0]?.updated_at ?? null).toBe(originalUpdatedAt);
  });
});
