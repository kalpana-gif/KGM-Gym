import { expect, test, type Page } from '@playwright/test';

async function openProfile(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Your profile', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your profile' })).toBeVisible();
}

async function fixedControlsFit(page: Page) {
  const layout = await page.getByRole('dialog').evaluate(dialog => {
    const tabs = dialog.querySelector('[role=tablist]')!.getBoundingClientRect();
    const footer = dialog.querySelector('.profile-footer')!.getBoundingClientRect();
    const body = dialog.querySelector('.modal-body')!.getBoundingClientRect();
    return {
      tabsVisible: tabs.top >= 0 && tabs.bottom <= innerHeight,
      footerVisible: footer.top >= 0 && footer.bottom <= innerHeight,
      bodyHeight: body.height,
      overflow: dialog.scrollWidth - dialog.clientWidth,
    };
  });
  expect(layout.tabsVisible).toBe(true);
  expect(layout.footerVisible).toBe(true);
  expect(layout.bodyHeight).toBeGreaterThan(60);
  expect(layout.overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
}

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
  { width: 667, height: 375 },
]) {
  test.describe(`profile at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, reducedMotion: 'reduce' });
    test('tabs retain edits, keep confirmation reachable, and save every section', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/food');
      await openProfile(page);
      await expect(page.getByRole('tab')).toHaveCount(3);
      await expect(page.getByRole('tab', { name: 'Body', exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.getByLabel('Weight · kg', { exact: true }).fill('102');
      await page.getByLabel('Sex input for energy equation').selectOption('male');
      await page.getByRole('combobox', { name: 'Activity level', exact: true }).selectOption('sedentary');
      await fixedControlsFit(page);
      await page.screenshot({ path: `artifacts/profile-${viewport.width}-body.png` });

      await page.getByRole('tab', { name: 'Meals & everyday life', exact: true }).click();
      await expect(page.getByRole('tabpanel', { name: 'Meals & everyday life', exact: true })).toBeVisible();
      await page.getByLabel('Food preference').selectOption('vegetarian');
      await page.getByLabel('Cooking access').selectOption('limited');
      await page.getByLabel('Allergies · comma separated').fill('peanut');
      await page.getByLabel(/I’ve reviewed this estimated target/).check();
      await page.getByRole('slider', { name: /Protein allocation/ }).press('End');
      await expect(page.getByLabel(/I’ve reviewed this estimated target/)).not.toBeChecked();
      await expect(page.locator('.profile-target')).toContainText('g protein');
      await fixedControlsFit(page);
      await page.screenshot({ path: `artifacts/profile-${viewport.width}-meals.png` });

      await page.getByRole('tab', { name: 'Movement & health', exact: true }).click();
      await page.getByLabel('Experience').selectOption('returning');
      await page.getByLabel('Equipment').selectOption('gym');
      await page.getByLabel('Injuries / movement limitations').fill('Sore left knee');
      await fixedControlsFit(page);
      await page.screenshot({ path: `artifacts/profile-${viewport.width}-movement.png` });

      await page.getByRole('tab', { name: 'Body', exact: true }).click();
      await expect(page.getByLabel('Weight · kg', { exact: true })).toHaveValue('102');
      await page.getByRole('tab', { name: 'Meals & everyday life', exact: true }).click();
      await expect(page.getByLabel('Allergies · comma separated')).toHaveValue('peanut');
      await expect(page.getByRole('slider', { name: /Protein allocation/ })).toHaveValue('35');
      await page.getByLabel(/I’ve reviewed this estimated target/).check();
      await page.getByRole('button', { name: 'Confirm & save my target' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.reload();
      await openProfile(page);
      await expect(page.getByLabel('Weight · kg', { exact: true })).toHaveValue('102');
      await page.getByRole('tab', { name: 'Meals & everyday life', exact: true }).click();
      await expect(page.getByLabel('Food preference')).toHaveValue('vegetarian');
      await expect(page.getByLabel('Cooking access')).toHaveValue('limited');
      await expect(page.getByLabel('Allergies · comma separated')).toHaveValue('peanut');
      await page.getByRole('tab', { name: 'Movement & health', exact: true }).click();
      await expect(page.getByLabel('Experience')).toHaveValue('returning');
      await expect(page.getByLabel('Equipment')).toHaveValue('gym');
      await expect(page.getByLabel('Injuries / movement limitations')).toHaveValue('Sore left knee');
      expect(errors).toEqual([]);
    });
  });
}

test('profile tabs support arrow keys, Home, End and a single tab stop', async ({ page }) => {
  await page.goto('/');
  await openProfile(page);
  const body = page.getByRole('tab', { name: 'Body', exact: true });
  await body.focus();
  await page.keyboard.press('ArrowRight');
  const meals = page.getByRole('tab', { name: 'Meals & everyday life', exact: true });
  await expect(meals).toBeFocused();
  await expect(meals).toHaveAttribute('aria-selected', 'true');
  await expect(body).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Movement & health', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(body).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Movement & health', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(body).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel', { name: 'Body', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Your profile', exact: true })).toBeFocused();
});

test('invalid body fields cannot be saved from another tab', async ({ page }) => {
  await page.goto('/');
  await openProfile(page);
  await page.getByLabel('Weight · kg', { exact: true }).fill('20');
  await page.getByRole('tab', { name: 'Movement & health', exact: true }).click();
  await page.getByRole('button', { name: 'Save details · keep estimates as a range' }).click();
  await expect(page.getByRole('dialog', { name: 'Your profile' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Body', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.toast')).toContainText('Enter valid adult age, height and weight.');
  await page.getByLabel('Weight · kg', { exact: true }).fill('103');
  await page.getByRole('tab', { name: 'Meals & everyday life', exact: true }).click();
  await page.getByRole('button', { name: 'Save details · keep estimates as a range' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
