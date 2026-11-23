import { expect, test, type Page } from '@playwright/test';

const estimate = {
  foods: [
    { name: 'Cooked red rice', grams: 150, kcalMin: 170, kcalMax: 230, proteinGrams: 4, carbsGrams: 40, fatGrams: 1, assumptions: 'Cooked rice; amount uncertain.' },
    { name: 'Restaurant mystery curry', grams: 125, kcalMin: 100, kcalMax: 220, proteinGrams: 10, carbsGrams: 15, fatGrams: 7, assumptions: 'Oil and ingredients uncertain.' },
  ],
  uncertainty: 'Simulated test estimate, not a live Gemini result.',
};
type SavedMeal = { data: { name: string; date: string; slot: string; items: { grams: number; food: { kcal: number; name: string; uncertainty: string } }[]; photoEstimate: typeof estimate } };

async function openPhoto(page: Page) {
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click();
  await page.getByRole('button', { name: 'Meal photo', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/rice-and-curry.jpg');
}
async function meals(page: Page): Promise<SavedMeal[]> {
  return page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('lankafit-v1', 1);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('records').objectStore('records').getAll();
      request.onsuccess = () => { db.close(); resolve(request.result.filter(row => row.entity === 'meal_logs' && !row.deleted)); };
    };
  }));
}
async function ready(page: Page) {
  await page.route('**/api/ai-status', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":true}' }));
  await page.goto('/food');
  await openPhoto(page);
  await expect(page.getByText(/No sign-in needed/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in for photo/ })).toHaveCount(0);
}

test('guest uploads a meal photo, reviews calories and saves editable meal details exactly once', async ({ page }) => {
  let calls = 0;
  let authCalls = 0;
  await page.route('**/auth/v1/**', route => { authCalls++; return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }); });
  await page.route('**/api/analyze-food', async route => {
    calls++;
    const input = route.request().postDataJSON();
    expect(input.consent).toBe(true);
    expect(input.mime).toBe('image/jpeg');
    expect(input.base64.length).toBeGreaterThan(0);
    expect(Object.keys(input).sort()).toEqual(['base64', 'consent', 'description', 'mime']);
    expect(route.request().headers().authorization).toBeUndefined();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(estimate) });
  });
  await ready(page);
  const action = page.getByRole('button', { name: 'Estimate calories', exact: true });
  await expect(action).toBeDisabled();
  await page.getByLabel(/Allow Google Gemini/).check();
  await action.click();
  await expect(page.getByRole('region', { name: 'Photo estimate' })).toContainText('270–450 kcal');
  expect(await meals(page)).toHaveLength(0);
  await expect(page.getByLabel('Grams', { exact: true }).first()).toHaveValue('150');
  await expect(page.getByLabel('Grams', { exact: true }).nth(1)).toHaveValue('125');
  await expect(page.getByLabel('Calories for Restaurant mystery curry')).toHaveValue('160');
  await page.getByRole('button', { name: 'Estimate again', exact: true }).click();
  await expect.poll(() => calls).toBe(2);
  await expect(page.getByLabel('Grams', { exact: true })).toHaveCount(2);
  await page.getByLabel('Calories for Restaurant mystery curry').fill('200');
  await page.getByLabel('Food name for Restaurant mystery curry').fill('Vegetable curry estimate');
  await page.getByLabel('Grams', { exact: true }).first().fill('180');
  await page.getByLabel('Meal name', { exact: true }).fill('Rice and curry photo test');
  await page.getByRole('dialog').getByRole('combobox', { name: 'Meal', exact: true }).selectOption('dinner');
  await page.getByRole('dialog').getByLabel('Diary date', { exact: true }).fill('2026-11-22');
  await page.locator('.estimate-box').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/kgm-fit-guest-photo-review-simulated.png' });
  await page.getByRole('button', { name: 'Confirm & save meal', exact: true }).dblclick();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await meals(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].data.name).toBe('Rice and curry photo test');
  expect(saved[0].data.slot).toBe('dinner');
  expect(saved[0].data.date).toBe('2026-11-22');
  expect(saved[0].data.items.map(item => item.grams)).toEqual([180, 125]);
  expect(saved[0].data.items[1].food.name).toBe('Vegetable curry estimate');
  expect(saved[0].data.items[1].food.kcal * 1.25).toBe(200);
  expect(saved[0].data.items[1].food.uncertainty).toBe('ai estimate');
  expect(saved[0].data.photoEstimate).toEqual(estimate);
  expect(authCalls).toBe(0);
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByLabel('Diary date', { exact: true }).fill(saved[0].data.date);
  await page.getByRole('button', { name: /Rice and curry photo test/ }).click();
  await expect(page.getByLabel('Calories for Vegetable curry estimate')).toHaveValue('200');
});

test('unconfigured or offline photo AI permits local drafts without making AI requests', async ({ page, context }) => {
  let requests = 0;
  await page.route('**/api/ai-status', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }));
  await page.route('**/api/analyze-food', route => { requests++; return route.fulfill({ status: 503, body: '{}' }); });
  await page.goto('/food');
  await openPhoto(page);
  await expect(page.getByRole('status').filter({ hasText: 'Photo AI is not connected yet' })).toBeVisible();
  await page.getByLabel(/Allow Google Gemini/).check();
  await expect(page.getByRole('button', { name: 'Estimate calories', exact: true })).toBeDisabled();
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline' })).toBeVisible();
  await page.getByRole('button', { name: 'Save offline draft', exact: true }).click();
  await expect(page.getByText('Saved photo drafts (1)', { exact: true })).toBeVisible();
  expect(requests).toBe(0);
  expect(await meals(page)).toHaveLength(0);
});

test('guest provider failure remains visible and manual logging stays available', async ({ page }) => {
  await page.route('**/api/analyze-food', route => route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"Photo analysis limit reached. Try manual entry."}' }));
  await ready(page);
  await page.getByLabel(/Allow Google Gemini/).check();
  await page.getByRole('button', { name: 'Estimate calories', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Photo analysis limit reached');
  await page.getByRole('button', { name: 'Search foods instead', exact: true }).click();
  await expect(page.getByLabel('Search foods', { exact: true })).toBeVisible();
  expect(await meals(page)).toHaveLength(0);
});

test('a non-food result cannot create a meal entry', async ({ page }) => {
  await page.route('**/api/analyze-food', route => route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"No food was identified in this photo."}' }));
  await ready(page);
  await page.getByLabel(/Allow Google Gemini/).check();
  await page.getByRole('button', { name: 'Estimate calories', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No food was identified');
  await expect(page.getByRole('button', { name: 'Confirm & save meal', exact: true })).toBeDisabled();
  expect(await meals(page)).toHaveLength(0);
});

for (const width of [320, 390, 1440]) {
  test(`AI calorie review and save controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/analyze-food', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(estimate),
    }));
    await ready(page);
    await page.getByLabel(/Allow Google Gemini/).check();
    await page.getByRole('button', { name: 'Estimate calories', exact: true }).click();
    await expect(page.getByLabel('Calories for Restaurant mystery curry')).toBeVisible();
    const layout = await page.getByRole('dialog').evaluate(dialog => {
      const body = dialog.querySelector<HTMLElement>('.modal-body')!;
      return {
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        dialogOverflow: body.scrollWidth - body.clientWidth,
        smallControls: Array.from(dialog.querySelectorAll<HTMLElement>('button, input, select'))
          .filter(control => control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden' &&
            !(control instanceof HTMLInputElement && ['checkbox', 'file'].includes(control.type)))
          .filter(control => control.getBoundingClientRect().height < 43.5)
          .map(control => control.getAttribute('aria-label') ?? control.textContent?.trim()),
      };
    });
    expect(layout.pageOverflow).toBeLessThanOrEqual(1);
    expect(layout.dialogOverflow).toBeLessThanOrEqual(1);
    expect(layout.smallControls).toEqual([]);
    await page.locator('.review-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/kgm-fit-photo-review-${width}.png` });
    await page.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await meals(page)).toHaveLength(1);
  });
}
