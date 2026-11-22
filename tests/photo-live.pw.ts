import { expect, test } from '@playwright/test';

test('live guest meal photo returns calories and can be logged without sign-in', async ({ page }) => {
  let result: { status: number; error?: string; foodCount?: number } | undefined;
  page.on('response', async response => {
    if (!response.url().endsWith('/api/analyze-food')) return;
    const body = await response.json().catch(() => ({}));
    result = { status: response.status(), error: body.error, foodCount: body.foods?.length };
  });
  await page.goto('/food');
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click();
  await page.getByRole('button', { name: 'Meal photo', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/rice-and-curry.jpg');
  await page.getByLabel(/Allow Google Gemini/).check();
  const button = page.getByRole('button', { name: 'Estimate calories', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(() => result, { timeout: 65_000 }).toBeDefined();
  if (result?.status !== 200) {
    await page.screenshot({ path: 'artifacts/kgm-fit-live-photo-failure.png' });
    throw new Error(`Live photo estimate failed: HTTP ${result?.status}. ${result?.error ?? 'No estimate returned.'}`);
  }
  await expect(page.getByRole('region', { name: 'Photo estimate' })).toContainText('kcal');
  expect(result.foodCount).toBeGreaterThan(0);
  await page.getByLabel('Meal name', { exact: true }).fill('Live rice and curry photo test');
  await page.locator('.estimate-box').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/kgm-fit-live-photo-result.png' });
  await page.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: /Live rice and curry photo test/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Live rice and curry photo test/ })).toBeVisible();
});
