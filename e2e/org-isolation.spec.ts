import { test, expect } from '@playwright/test';

const required = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_ORG_A_ACCESS_TOKEN',
  'E2E_ORG_B_ACCESS_TOKEN',
  'E2E_ORG_A_PROJECT_ID',
  'E2E_ORG_B_PROJECT_ID',
  'E2E_ORG_B_RESOURCE_IDS_JSON',
] as const;

test.describe('authenticated organization isolation', () => {
  test('Org A can access its project but cannot read Org B protected resources', async ({ request }) => {
    for (const name of required) {
      expect(process.env[name], `${name} must be configured; security E2E must fail closed`).toBeTruthy();
    }

    const baseUrl = process.env.E2E_SUPABASE_URL!;
    const anonKey = process.env.E2E_SUPABASE_ANON_KEY!;
    const tokenA = process.env.E2E_ORG_A_ACCESS_TOKEN!;
    const projectA = process.env.E2E_ORG_A_PROJECT_ID!;
    const projectB = process.env.E2E_ORG_B_PROJECT_ID!;
    const resources = JSON.parse(process.env.E2E_ORG_B_RESOURCE_IDS_JSON!);

    const client = await request.newContext({
      baseURL: `${baseUrl}/rest/v1`,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${tokenA}`,
        Accept: 'application/json',
      },
    });

    const own = await client.get(`/projects?id=eq.${encodeURIComponent(projectA)}&select=id`);
    expect(own.ok()).toBeTruthy();
    expect(await own.json()).toHaveLength(1);

    const foreign = await client.get(`/projects?id=eq.${encodeURIComponent(projectB)}&select=id`);
    expect(foreign.ok()).toBeTruthy();
    expect(await foreign.json()).toHaveLength(0);

    const tableMap: Record<string, string> = {
      sites: 'sites',
      roofs: 'roofs',
      designs: 'designs',
      design_versions: 'design_versions',
      panel_layouts: 'panel_layouts',
      panel_placements: 'panel_placements',
      simulation_runs: 'simulation_runs',
      engineering_results: 'engineering_results',
      financial_runs: 'financial_runs',
      bom_items: 'bom_items',
      proposals: 'proposals',
    };

    for (const [key, ids] of Object.entries(resources as Record<string, unknown>)) {
      const table = tableMap[key];
      if (!table) continue;
      for (const id of Array.isArray(ids) ? ids : [ids]) {
        if (!id) continue;
        const response = await client.get(`/${table}?id=eq.${encodeURIComponent(String(id))}&select=id`);
        expect(response.ok(), `${table} request failed`).toBeTruthy();
        expect(await response.json(), `${table}/${id} leaked across organizations`).toHaveLength(0);
      }
    }

    await client.dispose();
  });
});
