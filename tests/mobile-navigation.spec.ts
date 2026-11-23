import { expect, test } from '@playwright/test';

for (const viewport of [
  { width:280,height:653 },{ width:320,height:667 },{ width:360,height:740 },
  { width:375,height:667 },{ width:390,height:844 },{ width:414,height:896 },
  { width:430,height:932 },{ width:768,height:1000 },{ width:667,height:375 },
]) {
  test(`all six mobile destinations are directly accessible at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion:'reduce' });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name:'Mobile navigation' });
    await expect(nav.getByRole('button')).toHaveCount(6);
    await expect(nav.getByRole('button', { name:'More',exact:true })).toHaveCount(0);
    for (const [label,path] of [['Food','/food'],['History','/history'],['Meal plan','/plan'],['Workouts','/workouts'],['Progress','/progress'],['Today','/']]) {
      const button = nav.getByRole('button', { name:label,exact:true });
      await button.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(button).toHaveAttribute('aria-current','page');
      await expect(nav.locator('[aria-current=page]')).toHaveCount(1);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect.poll(async () => nav.evaluate(element => {
        const active = element.querySelector('[aria-current=page]')!.getBoundingClientRect();
        const bubble = element.querySelector('.mobile-nav-bubble')!.getBoundingClientRect();
        const icon = element.querySelector('[aria-current=page] .mobile-nav-icon')!.getBoundingClientRect();
        return Math.max(
          Math.abs(active.x + active.width / 2 - bubble.x - bubble.width / 2),
          Math.abs(icon.y + icon.height / 2 - bubble.y - bubble.height / 2),
        );
      })).toBeLessThanOrEqual(1);
      expect(await nav.locator('.mobile-nav-bubble').evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.x >= 0 && bounds.right <= innerWidth && bounds.y >= 0;
      })).toBe(true);
      if (label === 'Progress') await nav.screenshot({ path:`artifacts/mobile-navigation-progress-${viewport.width}.png` });
    }
    expect(await nav.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
        && element.scrollWidth <= element.clientWidth + 1;
    })).toBe(true);
    const header = page.getByRole('banner');
    await header.getByRole('button', { name:'Your profile',exact:true }).click();
    await expect(page.getByRole('dialog', { name:'Your profile',exact:true })).toBeVisible();
    await page.keyboard.press('Escape');
    await header.getByRole('button', { name:'Account and data',exact:true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await nav.getByRole('button').evaluateAll(buttons => buttons.every(button => {
      const rect = button.getBoundingClientRect();
      return rect.width >= 44 && rect.height >= 44;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path:`artifacts/mobile-navigation-${viewport.width}.png` });
    await page.setViewportSize({ width:1440,height:1000 });
    await expect(nav).toBeHidden();
    await expect(page.getByRole('navigation', { name:'Main navigation' }).getByRole('button')).toHaveCount(6);
  });
}

test('animated selection stays aligned when the phone viewport changes', async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 });
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name:'Mobile navigation' });
  for (const label of ['Progress','History','Meal plan','Today']) {
    await nav.getByRole('button', { name:label,exact:true }).click();
  }
  for (const viewport of [{ width:320,height:667 },{ width:667,height:375 },{ width:430,height:932 }]) {
    await page.setViewportSize(viewport);
    await nav.getByRole('button', { name:'Progress',exact:true }).click();
    await expect.poll(() => nav.evaluate(element => {
      const bubble = element.querySelector('.mobile-nav-bubble')!.getBoundingClientRect();
      const button = element.querySelector('[aria-current=page]')!.getBoundingClientRect();
      const icon = element.querySelector('[aria-current=page] .mobile-nav-icon')!.getBoundingClientRect();
      const notch = element.querySelector('mask circle')!;
      const notchCenter = Number(notch.getAttribute('cx')) + element.getBoundingClientRect().x;
      return Math.max(
        Math.abs(bubble.x + bubble.width / 2 - button.x - button.width / 2),
        Math.abs(bubble.y + bubble.height / 2 - icon.y - icon.height / 2),
        Math.abs(bubble.x + bubble.width / 2 - notchCenter),
      );
    })).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});
