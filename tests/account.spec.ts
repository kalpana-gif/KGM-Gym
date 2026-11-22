import { expect, test, type Page } from '@playwright/test';

// These routes never send an email or access a real account.
async function mockAuth(page: Page, status = 200) {
  const requests: string[] = [];
  await page.route('**/auth/v1/**', async route => {
    const request = route.request();
    if (request.url().includes('/otp')) {
      requests.push(request.postDataJSON().email);
      await route.fulfill({status, contentType:'application/json', body:JSON.stringify(status === 200 ? {} : {code:'over_email_send_rate_limit',msg:'Too many requests'})});
    } else await route.fulfill({status:401, contentType:'application/json', body:'{"message":"No test session"}'});
  });
  return requests;
}

async function accountFits(page: Page) {
  const dimensions = await page.locator('.modal-body').evaluate(el => ({
    pageOverflow:document.documentElement.scrollWidth-innerWidth,
    dialogOverflow:el.scrollWidth-el.clientWidth,
    smallTargets:Array.from(el.querySelectorAll('button,a.btn')).filter(button => {
      const rect=button.getBoundingClientRect();
      return rect.width > 0 && (rect.width < 43.5 || rect.height < 43.5);
    }).map(button=>button.textContent),
  }));
  expect(dimensions.pageOverflow).toBeLessThanOrEqual(1);
  expect(dimensions.dialogOverflow).toBeLessThanOrEqual(1);
  expect(dimensions.smallTargets).toEqual([]);
}

for (const width of [320,390,1440]) {
  test(`email sign-in at ${width}px shows next steps, blocks duplicate sends and restores progress`, async ({page}) => {
    await page.setViewportSize({width,height:width > 600 ? 1000 : 844});
    await page.emulateMedia({reducedMotion:'reduce'});
    const sent = await mockAuth(page);
    await page.goto('/');
    await page.getByRole('button',{name:'Account and data',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Save your progress'})).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveAttribute('autocomplete','email');
    await accountFits(page);
    if (width === 390 || width === 1440) await page.screenshot({path:`artifacts/kgm-fit-account-${width}.png`});
    await page.getByLabel('Email address').fill('test@gmail.com');
    await page.getByRole('button',{name:'Continue with email',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible();
    await expect(page.getByRole('link',{name:'Open Gmail'})).toHaveAttribute('href','https://mail.google.com/');
    await expect(page.getByRole('button',{name:/Resend in \d+s/})).toBeDisabled();
    expect(sent).toEqual(['test@gmail.com']);
    await accountFits(page);
    if (width === 390) await page.screenshot({path:'artifacts/kgm-fit-account-check-email.png'});
    await page.getByRole('button',{name:'Close dialog'}).click();
    await page.getByRole('button',{name:'Account and data',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible();
    await expect(page.getByRole('button',{name:/Resend in \d+s/})).toBeDisabled();
    await page.getByRole('button',{name:'Use a different email'}).click();
    await expect(page.getByLabel('Email address')).toHaveValue('test@gmail.com');
    await expect(page.getByRole('button',{name:/Try again in \d+s/})).toBeDisabled();
    expect(sent).toHaveLength(1);
    await page.getByRole('button',{name:'Continue on this device'}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('an expired email link returns to a recoverable sign-in form', async ({page}) => {
  await mockAuth(page);
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=expired-link');
  await expect(page.getByRole('dialog',{name:'Save your progress'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('expired or was already used');
  expect(page.url()).not.toContain('error=');
  await page.getByLabel('Email address').fill('test@example.com');
  await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('provider rate limits show an inline retry message without losing the diary', async ({page}) => {
  const sent = await mockAuth(page,429);
  await page.goto('/');
  await page.getByRole('button',{name:'Account and data',exact:true}).click();
  await page.getByLabel('Email address').fill('test@example.com');
  await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('wait a minute');
  await expect(page.getByRole('button',{name:/Try again in \d+s/})).toBeDisabled();
  expect(sent).toHaveLength(1);
  await page.getByRole('button',{name:'Continue on this device'}).click();
  await expect(page.getByRole('heading',{name:/Small steps/})).toBeVisible();
});

test('verified sign-in automatically imports the diary, recovers a failed upload and never imports it twice', async ({page}) => {
  const user = {id:'bb47df1f-e28c-437f-9b44-537b8d37e4a0',aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-11-22T00:00:00Z'};
  const server = new Map<string,Map<string,unknown>>();
  const operations = new Set<string>();
  let failUpload = true;
  let applied = 0;
  await page.route('**/auth/v1/**', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().url().includes('/user') ? user : {})});
  });
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/rpc/apply_change')) {
      if (failUpload) {
        await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Test backup temporarily unavailable"}'});
        return;
      }
      const change = request.postDataJSON();
      if (!operations.has(change.p_operation)) {
        operations.add(change.p_operation); applied++;
        const table = server.get(change.p_entity) ?? new Map<string,unknown>();
        table.set(change.p_id,{id:change.p_id,payload:change.p_payload,version:change.p_base_version+1,deleted:change.p_deleted,updated_at:new Date().toISOString()});
        server.set(change.p_entity,table);
      }
      await route.fulfill({status:200,contentType:'application/json',body:'{"status":"applied"}'});
    } else {
      const table = server.get(path.split('/').at(-1)!) ?? new Map();
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([...table.values()])});
    }
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Log a meal',exact:true}).click();
  await page.getByRole('button',{name:'Type a meal'}).click();
  await page.getByLabel('Describe your meal').fill('150 g cooked red rice');
  await page.getByRole('button',{name:'Review foods',exact:true}).click();
  await page.getByRole('button',{name:'Confirm & save meal',exact:true}).click();
  await page.getByRole('button',{name:'Account and data',exact:true}).click();
  await page.getByLabel('Email address').fill(user.email);
  await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible();

  const exp = Math.floor(Date.now()/1000)+3600;
  const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp})).toString('base64url'),'test-signature'].join('.');
  await page.goto(`/#access_token=${token}&refresh_token=test-refresh-token&token_type=bearer&expires_in=3600`);
  // Email redirects load a fresh document; a hash-only test navigation does not.
  await page.reload();
  await expect(page.getByRole('dialog',{name:'Your account & data'})).toBeVisible();
  await expect(page.getByText('Your account is connected',{exact:true})).toBeVisible();
  await accountFits(page);
  await expect(page.getByRole('button',{name:'Back up my device diary',exact:true})).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Supabase could not complete synchronization');
  expect(applied).toBe(0);
  failUpload = false;
  await page.getByRole('button',{name:'Sync now',exact:true}).click();
  await expect(page.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
  expect(applied).toBe(1);
  expect(server.get('meal_logs')?.size).toBe(1);
  await expect(page.getByRole('button',{name:'Back up my device diary',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Sync now',exact:true}).click();
  await expect(page.locator('.account-sync-message')).toContainText('All saved changes are synced to Supabase');
  expect(applied).toBe(1);
  await page.screenshot({path:'artifacts/kgm-fit-account-connected.png'});
});
