# KGM-FIT

A mobile-friendly Sri Lankan food, movement and weight companion. The local app works without cloud accounts or an AI key.

## Run locally

Use Node.js 22.12+ or a current supported Node release.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Start in guest mode, review **Your preferences**, and confirm a calorie target. The provided age (29), height (183 cm) and weight (103 kg) are prefilled; the equation input and activity level remain unselected.

```sh
npm test
npm run build
npm run preview
npm run test:e2e
```

Browser tests require Chromium: `npx playwright install chromium`. Production builds generate the service-worker asset list and `supabase/seed.sql`. `npm run dev` serves the photo AI status and analysis functions locally using the server values in `.env`. The preview server supports the frontend; deployed Netlify Functions or Netlify Dev provide the other server routes.

## What works locally

- Calorie and macro calculations with an explicit target review and historical daily target records.
- Manual food search, known-food text parsing, portion editing, daily totals, favorites, custom foods and recipes.
- Meal edit, delete, recovery and copy to the selected diary date.
- A History tab with Monday–Sunday daily calories, weekly totals, average calories per logged day and meals for any selected date. Existing saved meals appear automatically, including offline.
- Seven calculated days of meal plans, calorie-equivalent swaps, portion multipliers and an ingredient shopping list.
- Beginner home/band/gym exercise alternatives, timers, completed-set logging and history.
- Weight entries, date-spaced trends and food-energy charts.
- IndexedDB persistence, local photo drafts, JSON/CSV export and local diary deletion.
- Guest photo AI when the two Gemini server settings are configured: upload, review estimated calories, edit meal details and confirm a diary entry.
- An installable PWA: after the first successful production load, the app shell and catalog reopen offline.

No sample food consumption or fake AI output is preloaded. Actual food records affect totals; planned meals count only after confirmation.

## Interface and motion

KGM-FIT uses the supplied green and charcoal palette with tactile controls and local SVG illustrations. Color and material tokens live in `src/styles.css`. Framer Motion powers transitions, navigation, dialogs and charts, with reduced-motion support.

The same app adapts to phones, tablets and desktop browsers. Phone layouts stack panels, provide 44px or larger action targets, and use 16px form inputs. Full-screen phone dialogs have a fixed header and independent scrolling; week selectors scroll horizontally. Tablet navigation is available along the bottom, and larger desktop windows use a sidebar. Safe-area spacing accommodates device insets. Tests cover all pages and editors at 320, 360, 390, 768, 1024 and 1440 pixels, plus short landscape viewports.

The diary date selector fills the available width, with integrated previous/next-day controls and a readable date. Desktop shows the full month and a “Change date” button; phones use an abbreviated month and calendar icon. Focusing the date field allows typing in `YYYY-MM-DD` format. Diary, meal and weigh-in dates share a custom Monday-first calendar with month/year selectors, selected-day and today indicators, and a quick return to today. The calendar opens as a bottom sheet on phones and a centered dialog on desktop. Arrow keys navigate days, Page Up/Down navigate months, Shift+Page Up/Down navigate years, and Escape closes without changing the date. Impossible dates do not change the diary.

A floating + button opens photo meal entry from any page, above the mobile navigation. Choose or take a photo, request an estimate with the existing photo-sharing consent, then review foods, portions and calories before saving to the selected diary date. Photo preparation, AI analysis and meal saving show pulse indicators; AI analysis also scans the photo preview. Controls stay locked during these operations to prevent duplicate requests or saves. Other data updates use the same loading style. Reduced-motion preferences use static indicators.

The rename keeps the original local storage identifiers so an existing diary remains available. New exports use the `kgm-fit` filename prefix. System fonts, icons and animation code work offline after the first production load.

## Connect Supabase

1. Create a Supabase project.
2. Execute `supabase/migrations/001_lankafit.sql`, then `supabase/migrations/002_explicit_api_access.sql` in the SQL editor. Run the first migration once on a new project. The second provides the read access needed when automatic API grants are disabled; private rows remain protected by RLS.
3. Execute `supabase/seed.sql` after a local build. This provides the shared catalog. The offline app also bundles the same catalog.
4. In Authentication, enable email sign-in. Set the site URL and allowed redirect URLs to your Netlify URL and local development URL.
5. Copy the project URL and publishable key from Supabase's project API settings.
6. Copy `.env.example` to `.env` and fill:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
```

Restart Vite after changing these values. Use the cloud button and send an email sign-in link. Open the link in the same browser. After Supabase verifies the session, the app loads account records, automatically includes this device's guest diary, and uploads saved changes. Future meals, workouts, targets, weigh-ins, recipes and favorites synchronize automatically.

Public frontend keys rely on the included row-level security. Do not put service-role keys in frontend variables.

## Deploy on Netlify

1. Push the repository to your Git provider and import it into Netlify, or deploy using your existing Netlify workflow.
2. Build command: `npm run build`. Publish directory: `dist`. Functions directory: `netlify/functions`. These are declared in `netlify.toml`.
3. For optional accounts and cloud backup, configure the two `VITE_*` values for the frontend build.
4. Configure photo AI with these two server values using **Functions** scope:

```env
GEMINI_API_KEY=your_private_gemini_key
AI_MODEL=your_current_image_capable_model_id
```

Photo AI works without Supabase or sign-in. Authenticated account deletion separately requires server-side `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Keep private keys on the server.

`AI_MODEL` is a public model identifier, not a credential. `netlify.toml` excludes it from secret-value scanning so a configured model also mentioned in the server code or documentation does not block deployment. Gemini and service-role keys remain scanned.

5. Redeploy after environment changes. Add the deployed URL to Supabase's allowed authentication redirects.
6. Test `/food`, `/history`, `/plan`, `/workouts` and `/progress` by refreshing each URL. `/api/*` maps to functions before the SPA fallback.

Only public environment variables are included in the browser build. Inspect the built assets before deployment if adding new secrets or integrations.

## Optional Gemini AI

Create a Gemini key in Google AI Studio, then put it in the server-side `GEMINI_API_KEY` setting. Choose an image-capable model currently available to your account and set its identifier in `AI_MODEL`.

Free quotas, supported regions, models and service limits change. Confirm the model's current free tier in the official pricing page before enabling it. The application does not activate paid billing. Supabase, Netlify and AI usage can each have their own limits.

Confirm provider limits in the dashboards before deploying. The application's guest request limits are separate from any free or paid provider allowance.

The endpoint is `/api/analyze-food`. It:

- Accepts guest requests without an account or Supabase access token.
- Requires explicit consent and validates request size and image signatures.
- Sends only the meal photo/description to Gemini.
- Configures Netlify's platform rate limit at three requests per minute per IP/domain. An additional process-local limit uses a hashed platform/socket IP, allows one in-flight request, enforces 10-second spacing and limits requests to 15 per Colombo day. The daily count resets on process restart and is not shared across function instances; it is not a durable global quota.
- Uses a 45-second overall provider timeout and retries a temporary HTTP 503 once. The browser allows 60 seconds. Persistent busy, quota, timeout and invalid-result errors keep manual entry available.
- Validates returned food names, portions, calorie ranges and estimated macros, and rejects an empty/non-food result.
- Returns an editable suggestion; it never inserts a meal automatically.

### Photo calories in three steps

1. **Choose a photo.** Add a short description if helpful and accept sharing this meal with Gemini.
2. **Check the foods.** AI returns an approximate calorie range and fills the review. Unique catalog matches use their nutrition references; other foods use the AI range midpoint and estimated macros. Edit grams, and edit names/calories for AI foods. Portions change the displayed nutrition.
3. **Save the meal.** Set its name, breakfast/lunch/dinner/snacks and diary date, then confirm. The foods, portions, nutrition snapshots and original AI estimate are saved to IndexedDB and update that day's totals. Repeated save clicks do not create duplicate entries. Reopen a meal to edit it.

The screen checks `/api/ai-status` before enabling analysis. This endpoint reports whether the two Gemini server settings exist; it does not prove live provider readiness. Sign-in is optional. Offline, missing-server and provider-error states keep manual logging and local photo drafts available.

Run `npm run check:ai` for a credential-presence check without exposing values. Run `npm run check:ai -- --live` to send the actual public rice-and-curry fixture through the guest function. A successful, validated response is saved to `artifacts/ai-live-result.json`. Use `--image PATH --description TEXT` for another non-personal fixture.

Run `npm run test:ai:live` to upload the real fixture in Chromium, receive actual calories, save the reviewed meal and reload the diary. This needs configured Gemini settings and makes a real provider request. The ordinary browser suite simulates AI responses to test review editing, duplicate-save prevention, offline/error states and responsive layouts without depending on provider availability. Neither suite establishes the nutritional accuracy of a photograph.

Use `AI_TEST_BASE_URL=http://localhost:5173 npm run test:ai:live` to test an already-running development server on that exact address. Local photo routes read `.env` for each request; edits do not remain trapped in the process environment after Vite restarts. Explicit shell environment settings still take priority. The settings stay server-side.

On 22 November 2026, the live Chromium guest test passed with `gemini-3.5-flash-lite`: the uploaded rice-and-curry photo returned a validated calorie estimate, the reviewed meal saved successfully, and the entry remained after reload. The test also passed on the existing `http://localhost:5173` server after fixing stale environment settings. The local `.env` uses this verified model. Its request uses minimal thinking to keep the response quick. The earlier Flash models returned high-demand errors or timed out; model availability alone did not prove generation worked. Restart servers started before the settings-refresh fix once; future `.env` edits load per request. Redeploy after changing Netlify settings.

Free-provider data handling may permit using submitted content to improve products. The UI explains this before upload. Client-side image resizing removes source metadata by drawing and re-encoding the photo. HEIC is not accepted in this version; select or convert to JPEG, PNG or WebP.

Local drafts never synchronize their embedded image data. Cloud retention is a separate opt-in upload to the private `meal-photos` bucket. Users can remove retained cloud photos from the account panel. The current UI does not display cloud photo history; photos are optional supporting storage.

To test photo AI locally, run `npm run dev` with the server variables configured. Use Netlify Dev to exercise all server functions together. With missing keys, quota errors or offline connectivity, manual logging remains available.

## Offline data and synchronization

IndexedDB separates guest and authenticated owners. Local changes are immediate and durable; authenticated changes add versioned operations to an outbox.

The `apply_change` SQL function serializes competing changes, checks ownership, detects version conflicts and records operation IDs. Retries cannot create duplicate records. Deletions use tombstones so older remote data cannot resurrect a meal.

The server version wins a conflict deterministically, while the latest local version is kept in a recovery record. The account panel lets the user compare, restore the local edit as a new change, or keep the server version.

Sign-out opens a fresh guest diary, hides the previous account's local records and leaves unsynced work available when that same account signs in again. Authentication and cloud synchronization require connectivity. Verified sign-in automatically imports eligible guest records once. The guest diary is bound to that account so it cannot automatically move into a different account. The account is pulled first, and existing IDs—including deleted records—are skipped during import.

The account screen guides email sign-in through entering an address, verifying the newest Supabase Auth email, and automatic cloud synchronization. A successful request shows a dedicated inbox screen with a one-minute resend countdown that survives reopening the dialog. Expired callback links return to the sign-in screen with a new-link prompt. After completing a pending sign-in, the account panel shows the shared synchronization state, pending changes, errors and last successful sync. Email delivery still requires a correctly configured Supabase Auth email provider.

The signed-in session persists and refreshes automatically. Saved changes trigger sync after a short debounce; interrupted requests retry after 5 seconds with increasing delays up to one minute. Reconnecting, returning to the app and a one-minute periodic refresh pull changes from other signed-in devices. Automatic and manual sync share one in-flight request, and supported browsers serialize tabs with Web Locks. Each cycle verifies the user and pins its token so an account switch cannot upload an earlier owner's changes to a different account. Offline storage is a cache and durable upload queue; **Synced to Supabase** appears only after backend saves and reads succeed with no pending changes or unresolved conflicts.

Closing and reopening the app keeps the same account. A temporary session-refresh failure retains that account's cached diary and retries automatically when the connection recovers. A rejected access token is renewed once before retrying account verification or a backend sync; queued operation IDs prevent duplicate saves. Explicit sign-out or a revoked session returns to a fresh guest diary. Supabase auth and database requests have a 20-second network timeout so an interrupted request cannot leave synchronization stuck indefinitely.

Deleted meals stay recoverable with their payload until permanent account/diary deletion. Local photo draft deletion removes the image directly. Account deletion removes retained cloud objects, deletes the auth account with cascading database removal, and clears that account's local records and queues on the current device. Other devices remove their cache after signing out / clearing site data; an offline device cannot be remotely wiped.

Private browsing or clearing site data can remove IndexedDB. Use exports or cloud synchronization for backups.

## Nutrition and exercise provenance

`src/data/usda.json` contains 27 foods extracted from the official **USDA FoodData Central SR Legacy CSV dataset**. Each includes its actual FDC ID and source description. USDA reference foods are not necessarily identical to local Sri Lankan varieties.

Red rice, curd, fish and leafy greens use clearly described reference proxies. Sri Lankan prepared dishes are **provisional recipes**, calculated from the ingredient references and explicit assumed finished weights. Oil, coconut milk and sugar are included where present. Household measures remain approximate.

To reproduce the reference extraction:

```sh
python3 scripts/extract_usda.py /path/to/FoodData_Central_sr_legacy_food_csv_2018-04.zip
npm run build
```

Recipe definitions live in `src/data/catalog.ts`. Change ingredient amounts and actual batch yields for a closer match. No restaurant portion or hidden ingredient can be inferred precisely from a photograph.

Meal plans use familiar balanced meal patterns: a grain, suitable protein, vegetables/greens and optional snacks. They are not a dietitian-reviewed medical prescription. Budget preferences rotate affordable legumes/eggs more often; cooking preferences favor simple foods. Ingredient filtering supports catalog allergen labels, but cannot guarantee cross-contact safety.

The Ministry of Health's 2021 guidance, summarized by FAO, informs the template's less-refined grains, vegetable/leafy-green choices, daily fruit opportunities and plant-protein emphasis. Portions are scaled to energy and are not a guarantee of complete micronutrient coverage. Automatic targets are restricted to 1,500–4,000 kcal as a conservative product limit, not a universal medical rule; outside that range, the app asks for individual review instead.

Plans match the energy target but do not optimize meals to an exact macro split; the actual calculated macros are displayed. Exercise schedules provide general beginner alternatives and caution messages for conditions. Reporting an injury pauses automatic strength prescriptions pending professional review. They do not diagnose injuries or create rehabilitation programmes. Weight projections are intentionally omitted. No estimated exercise calories are added back to the food budget.

## Validation and external setup limits

Automated tests cover formulas and macros, actual recipe arithmetic, known/unknown food parsing, seven-day calorie totals, supported dietary restrictions, local persistence, queued versions, conflict recovery and photo privacy.

The SQL migration is also tested in a local PostgreSQL engine (PGlite) with Supabase-like auth and storage schemas. Tests exercise operation replay, stale-write rejection, ownership enforcement, child-record access, storage policies and restricted catalog writes.

Browser tests exercise 360/390 px screens, target review, text logging, offline reload, edit/delete/restore, plan logging and shopping, workout logging, photo fallback, and deep-link refreshes.

Current verification on 22 November 2026: 54 calculation/storage/PostgreSQL/endpoint/matching/synchronization tests and 32 ordinary Chromium browser workflows pass; the production build succeeds. Cloud tests cover every diary entity, guest import, queued deletions, backend failures, offline recovery, two-device changes, periodic refresh and account isolation. Ordinary photo, account and cloud browser tests simulate service responses; the previously completed separate live photo test successfully exercised Gemini and a persisted guest meal. Responsive checks cover every screen at 320, 360, 390, 768, 1024 and 1440 pixels, plus short landscape viewports; AI calorie review has dedicated 320, 390 and 1440 px checks. Browser tests generate desktop and phone screenshots locally in `artifacts/`. Live Supabase writes, physical iPhone/Safari installation and the deployed integrations still need validation on your deployment.

Live Supabase authentication, remote storage, free-tier eligibility and a public Netlify deployment depend on your accounts and configuration. Local Gemini photo generation has passed a real request test; it does not guarantee ongoing provider availability or nutrition accuracy. Local PostgreSQL tests cannot prove a separately configured production project's policies; run the same ownership checks against that project before real use.

## Official reference starting points

- [USDA downloadable datasets](https://fdc.nal.usda.gov/download-datasets)
- [Mifflin–St Jeor original research](https://pubmed.ncbi.nlm.nih.gov/2305711/)
- [Sri Lanka Ministry of Health Nutrition Division](https://nutrition.health.gov.lk/)
- [FAO summary of the Ministry of Health Sri Lankan dietary guidance](https://www.fao.org/nutrition/education/dietary-guidelines/regions/sri-lanka/en/)
- [CDC adult weight-management guidance](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html)
- [WHO physical activity guidance](https://www.who.int/news-room/fact-sheets/detail/physical-activity)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/)
- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini data-use terms](https://ai.google.dev/gemini-api/terms)
- [Supabase pricing](https://supabase.com/pricing)
- [Netlify Free comparison and credits](https://www.netlify.com/pricing/personal-vs-free/)
