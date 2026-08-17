import { test, expect } from "@playwright/test";

const projectId = process.env.E2E_PROJECT_ID;

test.describe("design persistence", () => {
  test.skip(!projectId, "Set E2E_PROJECT_ID to a seeded project used by the E2E environment.");

  test("save → refresh → load preserves the design", async ({ page }) => {
    await page.goto(`/projects/${projectId}/design`);
    await expect(page.getByRole("application", { name: "Solar design canvas" })).toBeVisible();

    // Add one deterministic panel to the default 10m × 6m roof.
    await page.getByRole("button", { name: "Panel" }).click();
    const canvas = page.getByRole("application", { name: "Solar design canvas" });
    await canvas.click({ position: { x: 220, y: 190 } });

    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();

    const before = {
      panels: await page.locator(".design-properties .metric").nth(0).innerText(),
      capacity: await page.locator(".design-properties .metric").nth(1).innerText(),
    };

    await page.reload();
    await expect(page.getByRole("application", { name: "Solar design canvas" })).toBeVisible();
    await expect(page.getByText(/Panels/).last()).toContainText("1");

    const after = {
      panels: await page.locator(".design-properties .metric").nth(0).innerText(),
      capacity: await page.locator(".design-properties .metric").nth(1).innerText(),
    };

    expect(after).toEqual(before);

    // The persisted panel must be rendered after the reload, not merely reflected in metrics.
    await expect(canvas.locator("g")).toHaveCount(1);
  });
});
