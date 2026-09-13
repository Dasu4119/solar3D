import { test, expect } from '@playwright/test';

type ResourceIds = Record<string, string>;

const EXPECTED_PROTECTED_TABLES = [
  'projects',
  'sites',
  'designs',
  'roofs',
  'panel_layouts',
  'simulation_runs',
  'financial_runs',
  'bom_runs',
  'proposal_runs',
] as const;

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required authenticated E2E secret: ${name}`);
  return value;
};

const resourceIds = (): ResourceIds => {
  const parsed = JSON.parse(required('E2E_ORG_B_RESOURCE_IDS_JSON')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('E2E_ORG_B_RESOURCE_IDS_JSON must be a JSON object of table -> row id');
  }
  const ids = parsed as ResourceIds;
  for (const table of EXPECTED_PROTECTED_TABLES) {
    if (!ids[table]) throw new Error(`E2E_ORG_B_RESOURCE_IDS_JSON is missing protected table: ${table}`);
  }
  return ids;
};

async function restRequest(
  baseUrl: string,
  anonKey: string,
  token: string,
  table: string,
  id: string,
  method: 'GET' | 'PATCH' = 'GET',
  body?: unknown,
) {
  return fetch(`${baseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectNoVisibleRows(response: Response, label: string) {
  expect([200, 204, 401, 403, 404], `${label}: unexpected status`).toContain(response.status);
  if (response.status === 200) {
    expect(await response.json(), `${label}: foreign row leaked`).toEqual([]);
  }
}

test.describe('authenticated organization isolation', () => {
  test('each organization can read its own project and cannot read the other project', async () => {
    const baseUrl = required('E2E_SUPABASE_URL').replace(/\/$/, '');
    const anonKey = required('E2E_SUPABASE_ANON_KEY');
    const orgAToken = required('E2E_ORG_A_ACCESS_TOKEN');
    const orgBToken = required('E2E_ORG_B_ACCESS_TOKEN');
    const orgAProjectId = required('E2E_ORG_A_PROJECT_ID');
    const orgBProjectId = required('E2E_ORG_B_PROJECT_ID');

    const aOwn = await restRequest(baseUrl, anonKey, orgAToken, 'projects', orgAProjectId);
    expect(aOwn.ok).toBeTruthy();
    expect(await aOwn.json()).toHaveLength(1);

    const bOwn = await restRequest(baseUrl, anonKey, orgBToken, 'projects', orgBProjectId);
    expect(bOwn.ok).toBeTruthy();
    expect(await bOwn.json()).toHaveLength(1);

    await expectNoVisibleRows(
      await restRequest(baseUrl, anonKey, orgAToken, 'projects', orgBProjectId),
      'Org A reading Org B project',
    );
    await expectNoVisibleRows(
      await restRequest(baseUrl, anonKey, orgBToken, 'projects', orgAProjectId),
      'Org B reading Org A project',
    );
  });

  test('Org A cannot read or update any protected Org B resource', async () => {
    const baseUrl = required('E2E_SUPABASE_URL').replace(/\/$/, '');
    const anonKey = required('E2E_SUPABASE_ANON_KEY');
    const orgAToken = required('E2E_ORG_A_ACCESS_TOKEN');
    const orgBToken = required('E2E_ORG_B_ACCESS_TOKEN');
    const ids = resourceIds();

    for (const table of EXPECTED_PROTECTED_TABLES) {
      const id = ids[table];

      const ownerRead = await restRequest(baseUrl, anonKey, orgBToken, table, id);
      expect(ownerRead.ok, `${table}: Org B cannot read its own fixture`).toBeTruthy();
      const ownerRows = await ownerRead.json();
      expect(ownerRows, `${table}: owner fixture must contain exactly one row`).toHaveLength(1);

      await expectNoVisibleRows(
        await restRequest(baseUrl, anonKey, orgAToken, table, id),
        `${table}: cross-org read`,
      );

      await expectNoVisibleRows(
        await restRequest(baseUrl, anonKey, orgAToken, table, id, 'PATCH', { id }),
        `${table}: cross-org update`,
      );

      const verifyOwnerRead = await restRequest(baseUrl, anonKey, orgBToken, table, id);
      expect(verifyOwnerRead.ok, `${table}: owner row unavailable after attack`).toBeTruthy();
      expect(await verifyOwnerRead.json(), `${table}: owner row changed/disappeared`).toHaveLength(1);
    }
  });
});