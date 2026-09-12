import { test, expect } from '@playwright/test';

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Required authenticated E2E environment variable is missing: ${name}`);
  return value;
};

test.describe('design persistence and production acceptance', () => {
  test('save → refresh → load preserves canonical project, production, and financial state', async ({ page }) => {
    const baseUrl = requireEnv('E2E_BASE_URL');
    const projectId = requireEnv('E2E_PROJECT_ID');
    requireEnv('E2E_STORAGE_STATE');

    await page.goto(`${baseUrl}/projects/${projectId}/design`, { waitUntil: 'domcontentloaded' });

    const state = page.locator('[data-testid="solar-design-state"]');
    await expect(state).toHaveAttribute('data-project-id', projectId, { timeout: 15000 });
    await expect(state).toHaveAttribute('data-roof-id', /.+/);
    await expect(state).toHaveAttribute('data-module-id', /.+/);
    const before = await state.getAttribute('data-state');
    expect(before).toBeTruthy();

    const production = page.getByRole('region', { name: /solar production summary/i });
    await expect(production).toBeVisible();
    const annualEnergy = production.getByText('Annual energy', { exact: true });
    await expect(annualEnergy).toBeVisible();
    await expect(annualEnergy.locator('..').getByText(/kWh$/)).toBeVisible();
    await expect(production.getByText(/Reference specific yield|Run annual simulation/i)).toBeVisible();

    const financial = page.getByRole('region', { name: /financial summary/i });
    await expect(financial).toBeVisible();
    await expect(financial.getByTestId('financial-not-configured')).toBeVisible();

    const save = page.getByRole('button', { name: /save/i });
    await expect(save).toBeVisible();
    await save.click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(state).toHaveAttribute('data-project-id', projectId, { timeout: 15000 });

    const after = await state.getAttribute('data-state');
    expect(after).toBe(before);
    await expect(page.getByRole('region', { name: /solar production summary/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /financial summary/i })).toBeVisible();
    await expect(page.getByTestId('financial-not-configured')).toBeVisible();
  });
});
