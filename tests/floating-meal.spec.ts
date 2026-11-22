import { expect, test } from '@playwright/test';

const estimate = {
  foods: [{ name: 'Photo curry test', grams: 150, kcalMin: 250, kcalMax: 350, proteinGrams: 15, carbsGrams: 30, fatGrams: 12, assumptions: 'Simulated food and portion.' }],
  uncertainty: 'Simulated estimate for browser verification.',
};

for (const width of [320, 390, 1000, 1440]) {
  test(`floating photo meal button fits and opens photos from every page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/ai-status', route => route.fulfill({ json: { configured: true } }));
    for (const path of ['/', '/food', '/history', '/plan', '/workouts', '/progress']) {
      await page.goto(path);
      const fab = page.getByRole('button', { name: 'Add meal from photo', exact: true });
      await expect(fab).toBeVisible();
      const bounds = await fab.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(56);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      if (width <= 1000) {
        const nav = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThan(nav!.y);
      }
      await fab.click();
      const dialog = page.getByRole('dialog', { name: 'What’s on your plate?', exact: true });
      await expect(dialog.getByRole('button', { name: 'Meal photo', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByText('Take or choose a meal photo', { exact: true })).toBeVisible();
      await expect(dialog.locator('input[type=file]')).toHaveAttribute('capture', 'environment');
      await expect(fab).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(fab).toBeFocused();
    }
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Add meal from photo', exact: true })).toBeVisible();
    await page.screenshot({ path: `artifacts/kgm-fit-floating-meal-${width}.png` });
  });

  test(`photo analysis shows loading, permits calorie review and saves once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/ai-status', route => route.fulfill({ json: { configured: true } }));
    let release!: () => void;
    const response = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    await page.route('**/api/analyze-food', async route => {
      calls++;
      await response;
      await route.fulfill({ json: estimate });
    });
    await page.goto('/');
    await page.getByLabel('Diary date', { exact: true }).fill('2026-11-22');
    await page.getByRole('button', { name: 'Add meal from photo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'What’s on your plate?', exact: true });
    await dialog.locator('input[type=file]').setInputFiles('tests/fixtures/rice-and-curry.jpg');
    await dialog.getByLabel(/Allow Google Gemini/).check();
    await dialog.getByRole('button', { name: 'Estimate calories', exact: true }).click();
    const status = dialog.getByRole('status').filter({ hasText: 'Estimating your meal…' });
    await expect(status).toBeVisible();
    await expect(dialog.locator('.photo-scan')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Estimating…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Search foods', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(await status.locator('.busy-orbit').evaluate(element => getComputedStyle(element, '::before').animationName)).toBe('none');
    await dialog.locator('.photo-picker').scrollIntoViewIfNeeded();
    await expect(status).toBeInViewport();
    await page.screenshot({ path: `artifacts/kgm-fit-photo-loading-${width}.png` });
    release();
    await expect(dialog.getByRole('region', { name: 'Photo estimate' })).toContainText('250–350 kcal');
    await expect(status).toHaveCount(0);
    await expect(dialog.locator('.photo-scan')).toHaveCount(0);
    await dialog.getByLabel('Calories for Photo curry test').fill('375');
    await dialog.getByLabel('Meal name', { exact: true }).fill('Floating photo meal');
    await expect(dialog.getByLabel('Diary date', { exact: true })).toHaveValue('2026-11-22');
    await dialog.getByRole('button', { name: 'Confirm & save meal', exact: true }).dblclick();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Floating photo meal/ })).toHaveCount(1);
    await expect(page.locator('.review-section')).toHaveCount(0);
    await expect(page.locator('.calorie-stats').getByText('375 kcal', { exact: true })).toBeVisible();
    await expect(page.locator('.toast')).toBeVisible();
    const toastBounds = await page.locator('.toast').boundingBox();
    const fabBounds = await page.getByRole('button', { name: 'Add meal from photo', exact: true }).boundingBox();
    expect(toastBounds!.y + toastBounds!.height).toBeLessThanOrEqual(fabBounds!.y);
    expect(calls).toBe(1);
  });
}

test('saving shows feedback, locks the review, and completes after the database write', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add meal from photo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'What’s on your plate?', exact: true });
  await dialog.getByRole('button', { name: 'Search foods', exact: true }).click();
  await dialog.locator('.food-result').first().click();
  await dialog.getByLabel('Meal name', { exact: true }).fill('Pending save meal');
  await page.evaluate(() => new Promise<void>(resolve => {
    const request = indexedDB.open('lankafit-v1', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['records', 'operations'], 'readwrite');
      let held = true;
      const pump = () => {
        if (!held) return;
        tx.objectStore('records').get('test-save-lock').onsuccess = pump;
      };
      pump();
      (window as unknown as { releaseMealSave: () => void }).releaseMealSave = () => { held = false; };
      tx.oncomplete = () => db.close();
      resolve();
    };
  }));
  await dialog.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
  const status = dialog.getByRole('status').filter({ hasText: 'Saving your meal…' });
  await expect(status).toBeVisible();
  await expect(status).toBeInViewport();
  await expect(dialog.locator('.modal-head')).toBeInViewport();
  expect(await status.locator('.busy-orbit').evaluate(element => getComputedStyle(element, '::before').animationName)).toBe('busy-ripple');
  await expect(dialog.getByRole('button', { name: 'Saving meal…', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Meal name', { exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'artifacts/kgm-fit-meal-saving.png' });
  await page.evaluate(() => (window as unknown as { releaseMealSave: () => void }).releaseMealSave());
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Pending save meal/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Add meal from photo', exact: true })).toBeFocused();
});
