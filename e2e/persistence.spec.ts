import { test, expect } from '@playwright/test';

test.describe('design persistence', () => {
  test('save → refresh → load preserves design state', async ({ page }) => {
    const baseUrl = process.env.E2E_BASE_URL;
    const projectId = process.env.E2E_PROJECT_ID;
    test.skip(!baseUrl || !projectId || !process.env.E2E_STORAGE_STATE, 'Authenticated E2E environment is not configured');

    await page.goto(`${baseUrl}/design/${projectId}`);
    await page.waitForLoadState('networkidle');

    const before = await page.locator('[data-testid="solar-design-state"]').getAttribute('data-state');
    expect(before).toBeTruthy();

    const save = page.getByRole('button', { name: /save/i });
    await expect(save).toBeVisible();
    await save.click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const after = await page.locator('[data-testid="solar-design-state"]').getAttribute('data-state');
    expect(after).toBe(before);
  });
});
