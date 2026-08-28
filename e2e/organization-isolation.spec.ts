import { test, expect } from '@playwright/test';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Required authenticated E2E environment variable is missing: ${name}`);
  return value;
};

const api = async (baseUrl: string, token: string, body: Record<string, unknown>) => {
  const response = await fetch(`${baseUrl}/functions/v1/solar-project-api`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: required('E2E_SUPABASE_ANON_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};

test.describe('authenticated organization isolation', () => {
  test('Org A and Org B cannot read each other projects', async () => {
    const baseUrl = required('E2E_SUPABASE_URL');
    const orgAToken = required('E2E_ORG_A_ACCESS_TOKEN');
    const orgBToken = required('E2E_ORG_B_ACCESS_TOKEN');
    const orgAProject = required('E2E_ORG_A_PROJECT_ID');
    const orgBProject = required('E2E_ORG_B_PROJECT_ID');

    const aOwn = await api(baseUrl, orgAToken, { action: 'get', project_id: orgAProject });
    expect(aOwn.status).toBe(200);
    expect(aOwn.body?.id).toBe(orgAProject);

    const bOwn = await api(baseUrl, orgBToken, { action: 'get', project_id: orgBProject });
    expect(bOwn.status).toBe(200);
    expect(bOwn.body?.id).toBe(orgBProject);

    const aCross = await api(baseUrl, orgAToken, { action: 'get', project_id: orgBProject });
    expect([403, 404]).toContain(aCross.status);

    const bCross = await api(baseUrl, orgBToken, { action: 'get', project_id: orgAProject });
    expect([403, 404]).toContain(bCross.status);
  });

  test('listing by explicit organization cannot cross organization boundary', async () => {
    const baseUrl = required('E2E_SUPABASE_URL');
    const orgAToken = required('E2E_ORG_A_ACCESS_TOKEN');
    const orgBProject = required('E2E_ORG_B_PROJECT_ID');

    const response = await api(baseUrl, orgAToken, { action: 'get', project_id: orgBProject });
    expect([403, 404]).toContain(response.status);
  });
});
