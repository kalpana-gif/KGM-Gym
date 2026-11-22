import { expect, test, type Page } from '@playwright/test';

async function logMeal(page: Page, name: string, date: string, slot: string, grams: string) {
  await page.goto('/food');
  const rice = page.getByRole('list', { name: 'Food catalog' }).getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Cooked white rice', exact: true }),
  });
  await rice.getByRole('button', { name: 'Add to meal', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Meal name', { exact: true }).fill(name);
  await dialog.getByLabel('Diary date', { exact: true }).fill(date);
  await dialog.getByRole('combobox', { name: 'Meal', exact: true }).selectOption(slot);
  await dialog.getByLabel('Grams', { exact: true }).fill(grams);
  await dialog.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

for (const width of [320, 390, 1440]) {
  test.describe(`food history at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', hasTouch: width < 768, isMobile: width < 768 });
    test('weekly totals, day selection, edits, deletion, recovery and reload use saved meals', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await logMeal(page, 'Monday breakfast', '2026-11-16', 'breakfast', '100');
      await logMeal(page, 'Monday lunch', '2026-11-16', 'lunch', '50');
      await logMeal(page, 'Tuesday dinner', '2026-11-17', 'dinner', '200');
      await logMeal(page, 'Next week lunch', '2026-11-23', 'lunch', '1000');
      const nav = page.getByRole('navigation', { name: width < 768 ? 'Mobile navigation' : 'Main navigation' });
      await nav.getByRole('button', { name: 'History', exact: true }).click();
      await expect(page).toHaveURL(/\/history$/);
      await expect(nav.getByRole('button', { name: 'History', exact: true })).toHaveAttribute('aria-current', 'page');
      await page.getByLabel('Diary date', { exact: true }).fill('2026-11-22');
      const week = page.getByRole('region', { name: 'Weekly calories' });
      await expect(week).toContainText('16 Nov 2026 – 22 Nov 2026');
      await expect(page.getByTestId('history-week-total')).toHaveText('455kcal');
      await expect(page.getByTestId('history-week-average')).toHaveText('228kcal / logged day');
      await expect(page.getByTestId('history-logged-days')).toHaveText('2of 7 days');
      await expect(page.getByRole('heading', { name: 'No meals saved for this day' })).toBeVisible();
      const monday = page.getByRole('button', { name: 'Monday, 16 November 2026: 195 kcal, 2 meals', exact: true });
      await monday.click();
      await expect(monday).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('history-day-total')).toHaveText('195kcal');
      await expect(page.getByRole('region', { name: 'Breakfast', exact: true })).toContainText('Monday breakfast');
      await expect(page.getByRole('region', { name: 'Lunch', exact: true })).toContainText('50 g Cooked white rice');
      await page.getByRole('button', { name: 'Open Monday lunch', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Grams', { exact: true }).fill('100');
      await page.getByRole('button', { name: 'Confirm & update meal', exact: true }).click();
      await expect(page.getByTestId('history-week-total')).toHaveText('520kcal');
      await expect(page.getByTestId('history-day-total')).toHaveText('260kcal');
      await page.getByRole('button', { name: 'Open Monday breakfast', exact: true }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByTestId('history-week-total')).toHaveText('390kcal');
      await expect(page.getByTestId('history-day-total')).toHaveText('130kcal');
      await expect(page.getByRole('button', { name: 'Open Monday breakfast', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Next week', exact: true }).click();
      await expect(page.getByTestId('history-week-total')).toHaveText('1,300kcal');
      await expect(page.getByRole('button', { name: 'Open Next week lunch', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Previous week', exact: true }).click();
      await expect(page.getByTestId('history-week-total')).toHaveText('390kcal');
      await page.goto('/food');
      await page.getByRole('button', { name: 'Recently deleted meals', exact: true }).click();
      await page.getByRole('button', { name: 'Restore', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(0);
      await page.goto('/history');
      await page.getByLabel('Diary date', { exact: true }).fill('2026-11-17');
      await expect(page.getByTestId('history-week-total')).toHaveText('520kcal');
      await expect(page.getByTestId('history-day-total')).toHaveText('260kcal');
      await expect(page.getByRole('button', { name: 'Open Tuesday dinner', exact: true })).toBeVisible();
      await page.reload();
      await page.getByLabel('Diary date', { exact: true }).fill('2026-11-17');
      await expect(page.getByTestId('history-week-total')).toHaveText('520kcal');
      await expect(page.getByRole('button', { name: 'Open Tuesday dinner', exact: true })).toBeVisible();
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({ path: `artifacts/kgm-fit-history-${width}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(await page.locator('button').evaluateAll(buttons => buttons.filter(button => {
        const rect = button.getBoundingClientRect();
        return button.getClientRects().length && (rect.width < 43.5 || rect.height < 43.5);
      }).map(button => button.getAttribute('aria-label') ?? button.textContent?.trim()))).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test('history opens offline and adds a meal to the selected past day', async ({ page, context }) => {
  await logMeal(page, 'Saved dinner', '2026-11-17', 'dinner', '100');
  await page.goto('/history');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve =>
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Diary date', { exact: true }).fill('2026-11-18');
  await expect(page.getByTestId('history-week-total')).toHaveText('130kcal');
  await page.getByRole('button', { name: 'Log for this day', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Diary date', { exact: true })).toHaveValue('2026-11-18');
  await page.getByLabel('Search foods', { exact: true }).fill('Cooked white rice');
  await page.locator('.food-result').first().click();
  await page.getByRole('dialog').getByLabel('Meal name', { exact: true }).fill('Offline lunch');
  await page.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
  await expect(page.getByTestId('history-logged-days')).toHaveText('2of 7 days');
  await expect(page.getByRole('button', { name: 'Open Offline lunch', exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Diary date', { exact: true }).fill('2026-11-18');
  await expect(page.getByRole('button', { name: 'Open Offline lunch', exact: true })).toBeVisible();
});
