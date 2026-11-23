import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`bakery search, piece calories and saved portions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/food');
    await page.getByRole('button', { name: 'Bakery & short eats', exact: true }).click();
    await expect(page.getByRole('heading', { name: '14 foods to explore' })).toBeVisible();
    const search = page.getByRole('textbox', { name: 'Search food catalog' });
    await search.fill('malu paan');
    await expect(page.getByRole('heading', { name: 'Fish bun', exact: true })).toBeVisible();
    await expect(page.locator('.food-card')).toHaveCount(1);
    await search.fill('pastries');
    await expect(page.locator('.food-card')).toHaveCount(3);
    await search.fill('fish pastry');
    const card = page.locator('.food-card');
    await expect(card.locator('.food-piece')).toContainText('(90 g approx.)');
    const pieceKcal = parseInt(await card.locator('.food-piece strong').innerText(), 10);
    await card.getByRole('button', { name: 'Add to meal', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Grams', { exact: true })).toHaveValue('90');
    await expect(dialog.locator('.review-section .badge')).toHaveText(`${pieceKcal} kcal`);
    await dialog.getByLabel('Serving for Fish pastry').selectOption('100');
    await expect(dialog.getByLabel('Grams', { exact: true })).toHaveValue('100');
    await dialog.getByLabel('Serving for Fish pastry').selectOption('90');
    await dialog.getByLabel('Meal name', { exact: true }).fill('Bakery snack');
    await dialog.getByRole('combobox', { name: 'Meal', exact: true }).selectOption('snacks');
    await dialog.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto('/');
    await page.getByRole('button', { name: /Bakery snack/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Grams', { exact: true })).toHaveValue('90');
    await expect(page.getByRole('dialog').locator('.review-section .badge')).toHaveText(`${pieceKcal} kcal`);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/food');
    await page.getByRole('button', { name: 'Bakery & short eats', exact: true }).click();
    await search.fill('rolls');
    await expect(page.locator('.food-card')).toHaveCount(4);
    await expect(page.locator('.page-transition')).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/bakery-${width}.png`, fullPage: true });
  });
}
