import { expect, test, type Page } from '@playwright/test';

const account = {
  id: 'bb47df1f-e28c-437f-9b44-537b8d37e4a0', aud: 'authenticated', role: 'authenticated',
  email: 'sync-test@example.com', email_confirmed_at: '2026-11-22T00:00:00Z',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-11-22T00:00:00Z',
};
type ServerRow = { id: string; user_id: string; payload: Record<string, unknown>; version: number; deleted: boolean; updated_at: string };
function backend() {
  const tables = new Map<string, Map<string, ServerRow>>();
  const operations = new Set<string>();
  let failWrites = false;
  let applied = 0;
  let reads = 0;
  return {
    tables, operations,
    get applied() { return applied; },
    get reads() { return reads; },
    set failWrites(value: boolean) { failWrites = value; },
    async attach(page: Page, user = account) {
      await page.route('**/auth/v1/**', async route => {
        const path = new URL(route.request().url()).pathname;
        await route.fulfill({
          status: path.endsWith('/logout') ? 204 : 200, contentType: 'application/json',
          body: path.endsWith('/logout') ? '' : JSON.stringify(path.endsWith('/user') ? user : {}),
        });
      });
      await page.route('**/rest/v1/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith('/rpc/apply_change')) {
          if (failWrites) {
            await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Simulated backend interruption"}' });
            return;
          }
          const change = request.postDataJSON();
          const table = tables.get(change.p_entity) ?? new Map<string, ServerRow>();
          const old = table.get(change.p_id);
          if (!operations.has(change.p_operation)) {
            if (old && old.user_id !== user.id) {
              await route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"42501","message":"Not authorized"}' });
              return;
            }
            if ((old?.version ?? 0) !== change.p_base_version) {
              await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'conflict', record: old }) });
              return;
            }
            operations.add(change.p_operation); applied++;
            table.set(change.p_id, {
              id: change.p_id, user_id: user.id, payload: change.p_payload,
              version: change.p_base_version + 1, deleted: change.p_deleted, updated_at: new Date().toISOString(),
            });
            tables.set(change.p_entity, table);
          }
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'applied', record: table.get(change.p_id) }) });
        } else {
          reads++;
          expect(url.searchParams.get('user_id')).toBe(`eq.${user.id}`);
          const rows = [...(tables.get(url.pathname.split('/').at(-1)!)?.values() ?? [])].filter(row => row.user_id === user.id);
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
        }
      });
    },
  };
}
async function connect(page: Page, user = account) {
  await page.getByRole('button', { name: 'Account and data', exact: true }).click();
  await page.getByLabel('Email address').fill(user.email);
  await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp })).toString('base64url'),
    'test-signature',
  ].join('.');
  // Start the fragment-only callback on the same path, then load its document
  // exactly once. Reloading a completed callback would close the welcome panel.
  await page.goto('/');
  await page.goto(`/#access_token=${token}&refresh_token=test-refresh-token&token_type=bearer&expires_in=3600`);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Your account & data' })).toBeVisible();
}
async function logMeal(page: Page, name: string, grams = '100') {
  await page.goto('/food');
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Cooked white rice', exact: true }) });
  await row.getByRole('button', { name: 'Add to meal', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Meal name', { exact: true }).fill(name);
  await dialog.getByLabel('Diary date', { exact: true }).fill('2026-11-22');
  await dialog.getByLabel('Grams', { exact: true }).fill(grams);
  await dialog.getByRole('button', { name: 'Confirm & save meal', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function synced(page: Page) {
  await expect(page.getByLabel('Synced to Supabase', { exact: true })).toBeVisible();
}
async function history(page: Page) {
  await page.goto('/history');
  await page.getByLabel('Diary date', { exact: true }).fill('2026-11-22');
}

test('verified account automatically uploads existing and new meals and receives another device’s edits', async ({ page, browser }) => {
  test.setTimeout(45000);
  const server = backend();
  await server.attach(page);
  await page.clock.install();
  await logMeal(page, 'Guest lunch', '150');
  await connect(page);
  await expect(page.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
  expect(server.tables.get('meal_logs')?.size).toBe(1);
  await expect(page.getByRole('button', { name: 'Back up my device diary', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await logMeal(page, 'Connected dinner', '100');
  await expect.poll(() => server.tables.get('meal_logs')?.size).toBe(2);
  await synced(page);
  await history(page);
  await expect(page.getByTestId('history-day-total')).toHaveText('325kcal');

  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const second = await other.newPage();
    await server.attach(second);
    await second.goto('/');
    await connect(second);
    await expect(second.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
    expect(server.applied).toBe(2);
    await second.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await history(second);
    await expect(second.getByTestId('history-day-total')).toHaveText('325kcal');
    await second.getByRole('button', { name: 'Open Guest lunch', exact: true }).click();
    await second.getByRole('dialog').getByLabel('Grams', { exact: true }).fill('200');
    await second.getByRole('button', { name: 'Confirm & update meal', exact: true }).click();
    await expect.poll(() => server.applied).toBe(3);
    await synced(second);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByTestId('history-day-total')).toHaveText('390kcal');
    await synced(page);

    // A background device checks the backend even without a local edit.
    const lunch = [...server.tables.get('meal_logs')!.values()].find(row => row.payload.name === 'Guest lunch')!;
    const items = lunch.payload.items as { grams: number }[];
    items[0].grams = 250; lunch.version++; lunch.updated_at = new Date().toISOString();
    await page.clock.fastForward(61000);
    await expect(page.getByTestId('history-day-total')).toHaveText('455kcal');
    await synced(page);
  } finally { await other.close(); }
});

test('failed and offline saves retry automatically and remain recoverable after reload', async ({ page, context }) => {
  const server = backend();
  await server.attach(page);
  await page.goto('/');
  await connect(page);
  await expect(page.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  server.failWrites = true;
  await logMeal(page, 'Retry lunch');
  await expect(page.getByLabel('Cloud sync needs attention', { exact: true })).toBeVisible();
  expect(server.applied).toBe(0);
  server.failWrites = false;
  await expect.poll(() => server.applied, { timeout: 12000 }).toBe(1);
  await synced(page);
  await history(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Open Retry lunch', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Grams', { exact: true }).fill('200');
  await page.getByRole('button', { name: 'Confirm & update meal', exact: true }).click();
  await expect(page.getByTestId('history-day-total')).toHaveText('260kcal');
  expect(server.applied).toBe(1);
  await context.setOffline(false);
  await expect.poll(() => server.applied).toBe(2);
  await synced(page);
  await page.reload();
  await page.getByLabel('Diary date', { exact: true }).fill('2026-11-22');
  await expect(page.getByTestId('history-day-total')).toHaveText('260kcal');
  await synced(page);
  expect(server.applied).toBe(2);
  await page.getByRole('button', { name: 'Account and data', exact: true }).click();
  await expect(page.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
  await expect(page.getByText(/Last successful sync:/)).toBeVisible();
  await page.screenshot({ path: 'artifacts/kgm-fit-account-auto-sync.png' });
});

test('sign-out isolates the account and automatically syncing a different account never copies its diary', async ({ page }) => {
  const server = backend();
  await server.attach(page);
  await logMeal(page, 'Private account lunch');
  await connect(page);
  await expect(page.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
  const original = [...server.tables.get('meal_logs')!.values()][0];
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Saved on device', { exact: true })).toBeVisible();
  await history(page);
  await expect(page.getByRole('button', { name: 'Open Private account lunch', exact: true })).toHaveCount(0);
  await page.unroute('**/auth/v1/**');
  await page.unroute('**/rest/v1/**');
  const different = { ...account, id: '1787558f-221f-4dba-8155-c1e0159352ab', email: 'another-test@example.com' };
  await server.attach(page, different);
  await connect(page, different);
  await expect(page.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await history(page);
  await expect(page.getByRole('button', { name: 'Open Private account lunch', exact: true })).toHaveCount(0);
  expect(server.applied).toBe(1);
  expect(original.user_id).toBe(account.id);
});
