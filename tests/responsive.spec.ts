import { expect, test, type Page } from '@playwright/test';

async function fits(page: Page, label: string) {
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    const scrollArea = dialog?.querySelector<HTMLElement>('.modal-body');
    return {
      page: document.documentElement.scrollWidth - innerWidth,
      dialog: scrollArea ? scrollArea.scrollWidth - scrollArea.clientWidth : 0,
      controls: Array.from((dialog ?? document).querySelectorAll<HTMLButtonElement>('button'))
        .filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden')
        .flatMap(button => {
          const rect = button.getBoundingClientRect();
          return rect.width < 43.5 || rect.height < 43.5
            ? [`${button.getAttribute('aria-label') ?? button.textContent?.trim()}: ${Math.round(rect.width)}×${Math.round(rect.height)}`]
            : [];
        }),
    };
  });
  expect(layout.page, `${label}: horizontal page overflow`).toBeLessThanOrEqual(1);
  expect(layout.dialog, `${label}: horizontal dialog overflow`).toBeLessThanOrEqual(1);
  expect(layout.controls, `${label}: controls need 44px touch targets`).toEqual([]);
}

async function dismissToast(page: Page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss message' });
  if (await dismiss.count()) {
    await dismiss.last().click();
    await expect(page.locator('.toast')).toHaveCount(0);
  }
}

async function capture(page: Page, name: string) {
  await dismissToast(page);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({ path: `artifacts/kgm-fit-${name}.png`, fullPage: true });
}

for (const width of [320, 360, 390, 768, 1024, 1440]) {
  test.describe(`${width}px responsive layout`, () => {
    test.use({
      viewport: { width, height: width >= 768 ? 1000 : 844 },
      hasTouch: width < 768,
      isMobile: width < 768,
      reducedMotion: 'reduce',
    });
    test('all pages, meal methods, preferences, recipes, account and shopping dialogs fit', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      await expect(page).toHaveTitle(/KGM-FIT/);
      await expect(page.getByRole('heading', { name: /Small steps/ })).toBeVisible();
      await fits(page, 'Today before setup');
      await page.getByRole('banner').getByRole('button', { name: 'Your profile', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Your profile' })).toBeVisible();
      await fits(page, 'Preferences with energy ranges');
      if (width === 390) await page.screenshot({ path: 'artifacts/kgm-fit-mobile-preferences.png' });
      if (width <= 600) {
        expect(await page.getByRole('dialog').evaluate(dialog => Math.abs(dialog.getBoundingClientRect().height - innerHeight))).toBeLessThanOrEqual(1);
        expect(await page.getByLabel('Height · cm').evaluate(input => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
      }
      await page.getByLabel('Sex input for energy equation').selectOption('male');
      await page.getByRole('combobox', { name: 'Activity level', exact: true }).selectOption('sedentary');
      await page.getByText('Movement & health', { exact: true }).click();
      await fits(page, 'Expanded health fields');
      await page.getByLabel(/I’ve reviewed this estimated target/).check();
      await page.getByRole('button', { name: 'Confirm & save my target' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.getByRole('button', { name: 'Log a meal', exact: true }).click();
      await page.getByLabel('Search foods', { exact: true }).fill('cooked red rice');
      await page.locator('.food-result').first().click();
      await page.getByLabel('Grams', { exact: true }).fill('200');
      await fits(page, 'Manual meal and portion controls');
      if (width === 390) await page.screenshot({ path: 'artifacts/kgm-fit-mobile-meal-review.png' });
      await page.getByRole('button', { name: 'Type a meal', exact: true }).click();
      await page.getByLabel('Describe your meal').fill('100 g chicken curry, 2 eggs');
      await page.getByRole('button', { name: 'Review foods', exact: true }).click();
      await fits(page, 'Text meal review');
      await page.getByRole('button', { name: 'Meal photo', exact: true }).click();
      await fits(page, 'Meal photo');
      if (width === 390) await page.screenshot({ path: 'artifacts/kgm-fit-mobile-photo.png' });
      const action = page.getByRole('button', { name: 'Confirm & save meal', exact: true });
      await action.scrollIntoViewIfNeeded();
      const actionIsReachable = await action.evaluate(button => {
        const body = button.closest('.modal-body')!.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        return rect.top >= body.top - 1 && rect.bottom <= body.bottom + 1;
      });
      expect(actionIsReachable).toBe(true);
      await action.click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await fits(page, 'Today with a meal');
      await capture(page, `${width}-today`);

      await page.goto('/food');
      await page.getByRole('button', { name: 'Custom food', exact: true }).click();
      await fits(page, 'Custom food');
      await page.getByLabel('Food name', { exact: true }).fill('Homemade toasted coconut and vegetable breakfast with a long name');
      await page.getByLabel('Calories · kcal', { exact: true }).fill('180');
      await page.getByLabel('Protein · g', { exact: true }).fill('8');
      await page.getByLabel('Carbohydrate · g', { exact: true }).fill('20');
      await page.getByLabel('Fat · g', { exact: true }).fill('6');
      await page.getByRole('button', { name: 'Save custom food', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: 'Custom recipe', exact: true }).click();
      await fits(page, 'Recipe editor');
      await page.getByLabel('Recipe name', { exact: true }).fill('Simple rice bowl');
      await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
      await page.getByRole('button', { name: 'Save recipe', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const search = page.getByRole('textbox', { name: 'Search food catalog' });
      await search.fill('Homemade toasted');
      await expect(search).toHaveValue('Homemade toasted');
      await expect(page.locator('.catalog-grid>.food-card')).toHaveCount(1);
      await expect(page.getByRole('heading', { name: /Homemade toasted coconut/ })).toBeVisible();
      await fits(page, 'Food catalog with long names');
      await capture(page, `${width}-food`);

      await page.goto('/plan');
      await expect(page.getByRole('button', { name: /I ate this/ })).toHaveCount(4);
      await fits(page, 'Meal plan');
      const days = page.getByRole('group', { name: 'Meal plan days' }).getByRole('button');
      await days.last().click();
      await expect(days.last()).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
      await fits(page, 'Shopping list');
      if (width === 390) await page.screenshot({ path: 'artifacts/kgm-fit-mobile-shopping.png' });
      await page.getByRole('dialog').getByRole('checkbox').last().check();
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await page.getByRole('button', { name: /^Swap / }).first().click();
      await fits(page, 'Food swap');
      await page.getByRole('combobox', { name: 'Replacement', exact: true }).selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Save swap', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await capture(page, `${width}-plan`);

      await page.goto('/workouts');
      await page.getByRole('group', { name: 'Workout days' }).getByRole('button', { name: /Mon/ }).click();
      await expect(page.locator('.exercise-card').first()).toBeVisible();
      await fits(page, 'Strength workout and timer');
      await page.getByRole('button', { name: /^Mark .* completed$/ }).first().click();
      await page.getByRole('button', { name: 'Save session', exact: true }).click();
      await expect(page.getByText('Your movement history', { exact: true })).toBeVisible();
      await expect(page.locator('.restore-row')).toHaveCount(1);
      await fits(page, 'Workout session history');
      await capture(page, `${width}-workouts`);

      await page.goto('/progress');
      await fits(page, 'Progress and charts');
      await page.getByLabel('Weight · kg', { exact: true }).fill('102.5');
      await page.getByRole('button', { name: 'Save weigh-in', exact: true }).click();
      await expect(page.getByText('102.5 kg', { exact: true }).first()).toBeVisible();
      await fits(page, 'Progress after weigh-in');
      await capture(page, `${width}-progress`);

      await page.goto('/history');
      await expect(page.getByRole('heading', { name: 'Weekly calories', exact: true })).toBeVisible();
      await fits(page, 'Food history and daily calorie chart');
      await page.getByRole('button', { name: 'Previous week', exact: true }).click();
      await fits(page, 'Food history empty week');
      await page.getByRole('button', { name: 'Back to today', exact: true }).click();
      await capture(page, `${width}-history-responsive`);

      await page.getByRole('button', { name: 'Account and data', exact: true }).click();
      await fits(page, 'Account and export');
      await page.getByText('Delete this guest diary', { exact: true }).click();
      await fits(page, 'Account with expanded controls');
      await page.getByText('Download a backup', { exact: true }).click();
      await fits(page, 'Account with backup downloads');
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
      expect((await download).suggestedFilename()).toBe('kgm-fit-export.json');
      await page.getByRole('button', { name: 'Close dialog' }).click();
      expect(errors).toEqual([]);
    });
  });
}

test('phone landscape and reduced viewport keep forms scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Your profile', exact: true }).click();
  await fits(page, 'Landscape preferences');
  await page.getByRole('button', { name: 'Save details · keep estimates as a range' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 380 });
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click();
  await page.getByRole('button', { name: 'Type a meal', exact: true }).click();
  await page.getByLabel('Describe your meal').fill('200 g cooked red rice');
  await page.getByRole('button', { name: 'Review foods', exact: true }).click();
  await fits(page, 'Reduced viewport meal editor');
  await page.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
