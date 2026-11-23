import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
  test.describe(`mobile meal tabs at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    test('each tab logs into the correct meal and preserves totals and saved entries', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('region', { name: 'Quick access' })).toHaveCount(0);
      const tabs = page.getByRole('tablist', { name: 'Food diary meals' });
      await expect(tabs.getByRole('tab')).toHaveCount(4);
      await expect(tabs.getByRole('tab', { name: 'Breakfast', exact: true })).toHaveAttribute('aria-selected', 'true');

      for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
        await tabs.getByRole('tab', { name: label, exact: true }).click();
        await expect(page.getByRole('tabpanel')).toHaveCount(1);
        const panel = page.getByRole('tabpanel', { name: label, exact: true });
        await expect(panel).toBeVisible();
        await panel.getByRole('button', { name: `Add ${label.toLowerCase()}`, exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('combobox', { name: 'Meal', exact: true })).toHaveValue(label.toLowerCase());
        await dialog.getByLabel('Meal name', { exact: true }).fill(`Test ${label}`);
        await dialog.getByLabel('Search foods', { exact: true }).fill('Cooked white rice');
        await dialog.locator('.food-result').first().click();
        await dialog.getByLabel('Grams', { exact: true }).fill('100');
        await dialog.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(panel.getByRole('button', { name: new RegExp(`Test ${label}`) })).toBeVisible();
        await expect(tabs.getByRole('tab', { name: label, exact: true })).toContainText('130 kcal');
      }

      await page.getByRole('button', { name: 'Dismiss message' }).last().click();
      await expect(page.locator('.calorie-stats')).toContainText('520');
      await page.screenshot({ path: `artifacts/diary-tabs-${width}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(await tabs.getByRole('tab').evaluateAll(buttons => buttons.every(button => {
        const rect = button.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44;
      }))).toBe(true);

      await page.reload();
      for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
        await tabs.getByRole('tab', { name: label, exact: true }).click();
        await expect(page.getByRole('tabpanel', { name: label, exact: true })).toContainText(`Test ${label}`);
        await expect(tabs.getByRole('tab', { name: label, exact: true })).toContainText('130 kcal');
      }
      const lunch = tabs.getByRole('tab', { name: 'Lunch', exact: true });
      await lunch.click();
      await page.getByRole('tabpanel').getByRole('button', { name: /Test Lunch/ }).click();
      await page.getByRole('dialog').getByLabel('Grams', { exact: true }).fill('200');
      await page.getByRole('button', { name: 'Confirm & update meal', exact: true }).click();
      await expect(lunch).toHaveAttribute('aria-selected', 'true');
      await expect(lunch).toContainText('260 kcal');
      await expect(tabs.getByRole('tab', { name: 'Breakfast', exact: true })).toContainText('130 kcal');
    });
  });
}

test('meal tabs support keyboard navigation and expand to all cards on desktop', async ({ page }) => {
  await page.goto('/');
  const tabs = page.getByRole('tablist', { name: 'Food diary meals' });
  const breakfast = tabs.getByRole('tab', { name: 'Breakfast', exact: true });
  await breakfast.focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Lunch', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab', { name: 'Snacks', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(breakfast).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.getByRole('tab', { name: 'Snacks', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(breakfast).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel', { name: 'Breakfast', exact: true })).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(tabs).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
  for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
    await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Quick access', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/diary-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tabs).toBeVisible();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
});
