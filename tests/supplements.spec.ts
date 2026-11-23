import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`Gold Standard scoop, milk and saved shake at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/food');
    await page.getByRole('button', { name: 'Protein supplements', exact: true }).click();
    await expect(page.getByRole('heading', { name: '12 foods to explore' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Search food catalog' }).fill('glod standerd');
    const card = page.locator('.food-card');
    await expect(card).toHaveCount(1);
    await expect(card.locator('.food-piece')).toContainText('120 kcal · 24 g protein');
    await expect(card.locator('.food-piece')).toContainText('1 scoop · 30.4 g powder');
    await card.getByText('Source & label', { exact: true }).click();
    await expect(card.getByRole('link', { name: 'View product label', exact: true }))
      .toHaveAttribute('href', 'https://dsld.od.nih.gov/label/332030');
    await card.getByRole('button', { name: 'Add to meal', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const powderName = 'ON Gold Standard 100% Whey — Double Rich Chocolate';
    await expect(dialog.getByLabel('Grams', { exact: true })).toHaveValue('30.4');
    await expect(dialog.locator('.review-section .badge')).toHaveText('120 kcal');
    await expect(dialog).toContainText('Use dry powder grams.');
    await dialog.getByLabel(`Serving for ${powderName}`).selectOption('15.2');
    await expect(dialog.locator('.review-section .badge')).toHaveText('60 kcal');
    await dialog.getByLabel(`Serving for ${powderName}`).selectOption('60.8');
    await expect(dialog.locator('.review-section .badge')).toHaveText('240 kcal');
    await dialog.getByLabel(`Serving for ${powderName}`).selectOption('30.4');
    await dialog.getByRole('textbox', { name: 'Search foods', exact: true }).fill('whole milk');
    await dialog.getByRole('button', { name: /Whole milk/ }).click();
    await dialog.getByLabel('Grams', { exact: true }).nth(1).fill('200');
    await expect(dialog.locator('.review-section .badge')).toHaveText('242 kcal');
    await dialog.getByLabel('Meal name', { exact: true }).fill('My protein shake');
    await dialog.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto('/');
    await page.getByRole('button', { name: /My protein shake/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Grams', { exact: true }).first()).toHaveValue('30.4');
    await expect(page.getByRole('dialog').getByLabel('Grams', { exact: true }).nth(1)).toHaveValue('200');
    await expect(page.getByRole('dialog').locator('.review-section .badge')).toHaveText('242 kcal');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.goto('/food');
    await page.getByRole('button', { name: 'Protein supplements', exact: true }).click();
    await expect(page.locator('.page-transition')).toHaveCSS('opacity', '1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/supplements-${width}.png`, fullPage: true });
  });
}
