import { test, expect } from '@playwright/test';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required authenticated E2E value: ${name}`);
  return value;
};

type JsonObject = Record<string, any>;

async function invoke(slug: string, body: JsonObject, options: { allowFailure?: boolean } = {}) {
  const baseUrl = required('E2E_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = required('E2E_SUPABASE_ANON_KEY');
  const token = required('E2E_ORG_A_ACCESS_TOKEN');
  const response = await fetch(`${baseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !options.allowFailure) {
    throw new Error(`${slug} returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  return { response, payload };
}

async function restRow(table: string, id: string) {
  const baseUrl = required('E2E_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = required('E2E_SUPABASE_ANON_KEY');
  const token = required('E2E_ORG_A_ACCESS_TOKEN');
  const response = await fetch(`${baseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `${table}:${id} must be readable by its owner`).toBeTruthy();
  const rows = await response.json();
  expect(rows).toHaveLength(1);
  return rows[0] as JsonObject;
}

function placements() {
  const result = [];
  let index = 0;
  for (const y of [2, 4, 6]) {
    for (const x of [2, 4, 6, 8]) {
      index += 1;
      result.push({ id: `rc-panel-${index}`, center: { x, y }, rotation: 0 });
    }
  }
  return result;
}

const roofGeometry = [
  { x: 0, y: 0 },
  { x: 12, y: 0 },
  { x: 12, y: 8 },
  { x: 0, y: 8 },
];

test.describe('authenticated commercial lineage release gate', () => {
  test('Design → Finalize → Site Weather → Engineering → Financial → BOM → Proposal → Reload, then rejects stale outputs', async ({ page }) => {
    test.setTimeout(120_000);

    const fixtureProjectId = required('E2E_ORG_A_PROJECT_ID');
    const appBaseUrl = required('E2E_BASE_URL');

    const { payload: ownerProject } = await invoke('solar-project-api', { action: 'get', project_id: fixtureProjectId });
    expect(ownerProject.organization_id).toBeTruthy();

    const { payload: created } = await invoke('solar-project-api', {
      action: 'create_project',
      project: {
        organization_id: ownerProject.organization_id,
        name: `RC Commercial ${Date.now()}`,
        status: 'draft',
        country: 'India',
        notes: 'Ephemeral authenticated commercial-lineage release gate',
      },
      site: {
        name: 'RC Commercial Site',
        latitude: 16.3067,
        longitude: 80.4365,
      },
      design_name: 'RC Commercial Design',
    });
    expect(created.success).toBe(true);
    const projectId = created.project.id as string;
    const designId = created.design.id as string;

    const { payload: context } = await invoke('solar-project-api', { action: 'get_design_context', project_id: projectId });
    expect(context.success).toBe(true);
    const moduleId = context.module.id as string;
    expect(moduleId).toBeTruthy();

    const panels = placements();
    const saveBody = {
      action: 'save_design',
      design_id: designId,
      roof: { geometry: roofGeometry, area_m2: 96, pitch_degrees: 0, azimuth_degrees: 180, roof_type: 'flat' },
      module_id: moduleId,
      setback_m: 0.3,
      panel_placements: panels,
      dc_capacity_kw: 4.8,
      metrics: { panel_count: 12, dc_capacity_kw: 4.8 },
    };

    const { payload: savedV1 } = await invoke('solar-project-api', saveBody);
    expect(savedV1.success).toBe(true);
    const version1Id = savedV1.draft_version.id as string;
    const roofId = savedV1.roof.id as string;
    expect(savedV1.panel_layout.module_id).toBe(moduleId);
    expect(savedV1.panel_layout.panel_count).toBe(12);

    const { payload: finalized } = await invoke('design-finalization', { design_version_id: version1Id });
    expect(finalized.success).toBe(true);
    expect(finalized.status).toBe('finalized');
    expect(finalized.electrical.strings).toBeGreaterThan(0);

    const { payload: simulation } = await invoke('solar-energy-simulation', {
      design_version_id: version1Id,
      provenance_class: 'site_weather',
      latitude: 16.3067,
      longitude: 80.4365,
      performance_ratio: 0.8,
      annual_degradation_percent: 0.5,
      years: 25,
    });
    expect(simulation.success).toBe(true);
    expect(simulation.provenance.class).toBe('site_weather');
    expect(simulation.simulation_run.result_hash).toBeTruthy();
    const simulationRunId = simulation.simulation_run.id as string;

    const { payload: engineering } = await invoke('solar-engineering', { design_version_id: version1Id });
    expect(engineering.success).toBe(true);
    expect(engineering.valid).toBe(true);
    expect(engineering.simulation_run_id).toBe(simulationRunId);
    expect(engineering.acceptance.status).toBe('valid');

    const { payload: financial } = await invoke('solar-financials', {
      design_version_id: version1Id,
      simulation_run_id: simulationRunId,
      capex: 300000,
      annual_opex: 5000,
      energy_tariff: 8.5,
      export_tariff: 3.5,
      self_consumption_percent: 80,
      tariff_escalation_percent: 3,
      degradation_percent: 0.5,
      discount_rate_percent: 8,
      years: 25,
    });
    expect(financial.success).toBe(true);
    expect(financial.financial_run.result_hash).toBeTruthy();
    const financialRunId = financial.financial_run.id as string;

    const { payload: bom } = await invoke('commercial-output', {
      action: 'generate_bom',
      design_version_id: version1Id,
      financial_run_id: financialRunId,
    });
    expect(bom.success).toBe(true);
    expect(bom.bom.result_hash).toBeTruthy();
    const bomRunId = bom.bom.id as string;

    const { payload: proposal } = await invoke('commercial-output', {
      action: 'generate_proposal',
      design_version_id: version1Id,
      financial_run_id: financialRunId,
      bom_run_id: bomRunId,
    });
    expect(proposal.success).toBe(true);
    expect(proposal.proposal.result_hash).toBeTruthy();
    const proposalRunId = proposal.proposal.id as string;

    const simulationRow = await restRow('simulation_runs', simulationRunId);
    const financialRow = await restRow('financial_runs', financialRunId);
    const bomRow = await restRow('bom_runs', bomRunId);
    const proposalRow = await restRow('proposal_runs', proposalRunId);
    expect(financialRow.simulation_run_id).toBe(simulationRunId);
    expect(financialRow.source_simulation_result_hash).toBe(simulationRow.result_hash);
    expect(bomRow.financial_run_id).toBe(financialRunId);
    expect(bomRow.source_financial_result_hash).toBe(financialRow.result_hash);
    expect(proposalRow.bom_run_id).toBe(bomRunId);
    expect(proposalRow.financial_run_id).toBe(financialRunId);
    expect(proposalRow.source_bom_result_hash).toBe(bomRow.result_hash);
    expect(proposalRow.source_financial_result_hash).toBe(financialRow.result_hash);

    const { payload: ready } = await invoke('commercial-readiness', { project_id: projectId });
    expect(ready.success).toBe(true);
    expect(ready.readiness).toMatchObject({
      designFinalized: true,
      engineeringAccepted: true,
      simulationCompleted: true,
      financialCompleted: true,
      bomAvailable: true,
      proposalAvailable: true,
      simulationProvenance: 'site_weather',
    });
    expect(ready.readiness.source).toMatchObject({
      projectId,
      designVersionId: version1Id,
      simulationRunId,
      financialRunId,
      bomRunId,
      proposalRunId,
    });

    await page.goto(`${appBaseUrl}/projects/${projectId}/design`, { waitUntil: 'domcontentloaded' });
    const readinessPanel = page.getByTestId('commercial-readiness');
    await expect(readinessPanel).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
    await expect(readinessPanel.getByText('Site/weather', { exact: true })).toBeVisible();
    await expect(readinessPanel.getByText('Proposal snapshot', { exact: true }).locator('..')).toHaveAttribute('data-complete', 'true');

    // Create and finalize a new immutable design version. Old commercial outputs
    // must immediately stop satisfying readiness for the new active version.
    const { payload: savedV2 } = await invoke('solar-project-api', {
      ...saveBody,
      roof: { id: roofId, geometry: roofGeometry, area_m2: 96, pitch_degrees: 0, azimuth_degrees: 180, roof_type: 'flat' },
      change_summary: 'RC stale-lineage proof',
    });
    expect(savedV2.success).toBe(true);
    const version2Id = savedV2.draft_version.id as string;
    expect(version2Id).not.toBe(version1Id);

    const { payload: finalizedV2 } = await invoke('design-finalization', { design_version_id: version2Id });
    expect(finalizedV2.success).toBe(true);

    const { payload: staleReadiness } = await invoke('commercial-readiness', { project_id: projectId });
    expect(staleReadiness.success).toBe(true);
    expect(staleReadiness.readiness.designFinalized).toBe(true);
    expect(staleReadiness.readiness.engineeringAccepted).toBe(false);
    expect(staleReadiness.readiness.simulationCompleted).toBe(false);
    expect(staleReadiness.readiness.financialCompleted).toBe(false);
    expect(staleReadiness.readiness.bomAvailable).toBe(false);
    expect(staleReadiness.readiness.proposalAvailable).toBe(false);
    expect(staleReadiness.readiness.source.designVersionId).toBe(version2Id);
    expect(staleReadiness.readiness.source.financialRunId).toBeNull();
    expect(staleReadiness.readiness.source.bomRunId).toBeNull();
    expect(staleReadiness.readiness.source.proposalRunId).toBeNull();

    const staleBomAttempt = await invoke('commercial-output', {
      action: 'generate_bom',
      design_version_id: version1Id,
      financial_run_id: financialRunId,
    }, { allowFailure: true });
    expect(staleBomAttempt.response.ok).toBe(false);
    expect(String(staleBomAttempt.payload.error ?? '')).toMatch(/active finalized design version/i);
  });
});
