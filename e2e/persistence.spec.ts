import { test, expect } from '@playwright/test';

test.describe('design persistence and production acceptance', () => {
  test('save → refresh → load preserves design, production, and financial state', async ({ page }) => {
    const baseUrl = process.env.E2E_BASE_URL;
    const projectId = process.env.E2E_PROJECT_ID;
    test.skip(!baseUrl || !projectId || !process.env.E2E_STORAGE_STATE, 'Authenticated E2E environment is not configured');

    await page.goto(`${baseUrl}/design/${projectId}`);
    await page.waitForLoadState('networkidle');

    const state = page.locator('[data-testid="solar-design-state"]');
    const before = await state.getAttribute('data-state');
    expect(before).toBeTruthy();

    const production = page.getByRole('region', { name: /solar production summary/i });
    await expect(production).toBeVisible();
    await expect(production.getByText('Annual energy')).toBeVisible();
    await expect(production.getByText(/kWh/)).toBeVisible();
    await expect(production.getByText(/Reference specific yield|Run annual simulation/i)).toBeVisible();

    const financial = page.getByRole('region', { name: /financial summary/i });
    await expect(financial).toBeVisible();
    await expect(financial.getByTestId('financial-not-configured')).toBeVisible();

    const save = page.getByRole('button', { name: /save/i });
    await expect(save).toBeVisible();
    await save.click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const after = await state.getAttribute('data-state');
    expect(after).toBe(before);
    await expect(page.getByRole('region', { name: /solar production summary/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /financial summary/i })).toBeVisible();
    await expect(page.getByTestId('financial-not-configured')).toBeVisible();
  });
});
