import { expect, test } from '@playwright/test';

for (const width of [320, 375, 390, 768, 1440]) {
  test(`full-width date selector and calendar fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 390 ? 667 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const field = page.getByLabel('Diary date', { exact: true });
    await field.fill('2026-11-22');
    const widthDifference = await page.locator('.date-control').evaluate(control => {
      const main = control.closest('main')!;
      const style = getComputedStyle(main);
      return main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - control.getBoundingClientRect().width;
    });
    expect(Math.abs(widthDifference)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Open diary date calendar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose a date', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('grid', { name: 'November 2026' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Sunday, 22 November 2026', exact: true })).toBeFocused();
    const layout = await dialog.evaluate(element => ({
      overflow: element.scrollWidth - element.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      smallControls: Array.from(element.querySelectorAll<HTMLElement>('button, select')).filter(control => {
        const bounds = control.getBoundingClientRect();
        return bounds.width < 43.5 || bounds.height < 43.5;
      }).map(control => control.getAttribute('aria-label')),
    }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.pageOverflow).toBeLessThanOrEqual(1);
    expect(layout.smallControls).toEqual([]);
    await page.screenshot({ path: `artifacts/kgm-fit-calendar-${width}.png` });
    await dialog.getByRole('button', { name: 'Monday, 23 November 2026', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(field).toHaveValue('2026-11-23');
    await expect(page.getByRole('button', { name: 'Open diary date calendar', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Previous diary day', exact: true }).click();
    await expect(field).toHaveValue('2026-11-22');
    await page.getByRole('button', { name: 'Next diary day', exact: true }).click();
    await expect(field).toHaveValue('2026-11-23');
  });
}

test('keyboard navigation crosses months and Escape preserves the selected diary day', async ({ page }) => {
  await page.goto('/');
  const field = page.getByLabel('Diary date', { exact: true });
  await field.fill('2026-12-31');
  await field.press('ArrowDown');
  const dialog = page.getByRole('dialog', { name: 'Choose a date', exact: true });
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('grid', { name: 'January 2027' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Friday, 1 January 2027', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('2027-01-01');
  await field.click();
  await page.keyboard.press('PageDown');
  await expect(dialog.getByRole('grid', { name: 'February 2027' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(field).toHaveValue('2027-01-01');
});

test('month and year selectors support leap days and Today returns to the local diary date', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Diary date', { exact: true }).fill('2026-11-22');
  await page.getByRole('button', { name: 'Open diary date calendar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose a date', exact: true });
  await dialog.getByLabel('Calendar year').selectOption('2024');
  await dialog.getByLabel('Calendar month').selectOption('2');
  await dialog.getByRole('button', { name: 'Thursday, 29 February 2024', exact: true }).click();
  await expect(page.getByLabel('Diary date', { exact: true })).toHaveValue('2024-02-29');
  await page.getByRole('button', { name: 'Open diary date calendar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Back to today', exact: true }).click();
  const today = await page.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
  });
  await expect(page.getByLabel('Diary date', { exact: true })).toHaveValue(today);
});

test('meal calendar opens inside the meal dialog and changing its date preserves the review', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log a meal', exact: true }).click();
  const meal = page.getByRole('dialog', { name: 'What’s on your plate?', exact: true });
  await meal.getByRole('button', { name: 'Type a meal', exact: true }).click();
  await meal.getByLabel('Describe your meal').fill('150 g cooked white rice');
  await meal.getByRole('button', { name: 'Review foods', exact: true }).click();
  await meal.getByLabel('Meal name', { exact: true }).fill('Calendar review test');
  await meal.getByLabel('Diary date', { exact: true }).fill('2026-11-22');
  await meal.getByRole('button', { name: 'Open diary date calendar', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'Choose a date', exact: true });
  await calendar.getByRole('button', { name: 'Friday, 20 November 2026', exact: true }).click();
  await expect(calendar).toHaveCount(0);
  await expect(meal.getByLabel('Diary date', { exact: true })).toHaveValue('2026-11-20');
  await expect(meal.getByLabel('Meal name', { exact: true })).toHaveValue('Calendar review test');
  await expect(meal.getByLabel('Grams', { exact: true })).toHaveValue('150');
  await meal.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
  await expect(meal).toHaveCount(0);
  await page.getByRole('button', { name: 'Open diary date calendar', exact: true }).click();
  await calendar.getByLabel('Calendar year').selectOption('2026');
  await calendar.getByLabel('Calendar month').selectOption('11');
  await calendar.getByRole('button', { name: 'Friday, 20 November 2026', exact: true }).click();
  await expect(page.getByRole('button', { name: /Calendar review test/ })).toBeVisible();
});

test('invalid typed dates revert without changing the active diary date', async ({ page }) => {
  await page.goto('/');
  const field = page.getByLabel('Diary date', { exact: true });
  await field.fill('2026-11-22');
  await field.fill('2026-02-30');
  await field.press('Tab');
  await expect(field).toHaveValue('2026-11-22');
});
