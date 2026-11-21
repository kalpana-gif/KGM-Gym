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

Browser tests require Chromium: `npx playwright install chromium`. Production builds generate the service-worker asset list and `supabase/seed.sql`. The preview server supports the frontend; Netlify Functions need Netlify Dev or deployment.

## What works locally

- Calorie and macro calculations with an explicit target review and historical daily target records.
- Manual food search, known-food text parsing, portion editing, daily totals, favorites, custom foods and recipes.
- Meal edit, delete, recovery and copy to the selected diary date.
- Seven calculated days of meal plans, calorie-equivalent swaps, portion multipliers and an ingredient shopping list.
- Beginner home/band/gym exercise alternatives, timers, completed-set logging and history.
- Weight entries, date-spaced trends and food-energy charts.
- IndexedDB persistence, local photo drafts, JSON/CSV export and local diary deletion.
- An installable PWA: after the first successful production load, the app shell and catalog reopen offline.

No sample food consumption or fake AI output is preloaded. Actual food records affect totals; planned meals count only after confirmation.

## Interface and motion

KGM-FIT uses the supplied green and charcoal palette with tactile controls and local SVG illustrations. Color and material tokens live in `src/styles.css`. Framer Motion powers transitions, navigation, dialogs and charts, with reduced-motion support.

The same app adapts to phones, tablets and desktop browsers. Phone layouts stack panels, provide 44px or larger action targets, and use 16px form inputs. Full-screen phone dialogs have a fixed header and independent scrolling; week selectors scroll horizontally. Tablet navigation is available along the bottom, and larger desktop windows use a sidebar. Safe-area spacing accommodates device insets. Tests cover all pages and editors at 320, 360, 390, 768, 1024 and 1440 pixels, plus short landscape viewports.

The rename keeps the original local storage identifiers so an existing diary remains available. New exports use the `kgm-fit` filename prefix. System fonts, icons and animation code work offline after the first production load.

## Connect Supabase

1. Create a Supabase project.
2. Execute `supabase/migrations/001_lankafit.sql` in the SQL editor. Run it once on a new project.
3. Execute `supabase/seed.sql` after a local build. This provides the shared catalog. The offline app also bundles the same catalog.
4. In Authentication, enable email sign-in. Set the site URL and allowed redirect URLs to your Netlify URL and local development URL.
5. Copy the project URL and publishable key from Supabase's project API settings.
6. Copy `.env.example` to `.env` and fill:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
```

Restart Vite after changing these values. Use the cloud button and send an email sign-in link. Open the link on the same device. Import the earlier guest diary explicitly from the account panel if wanted.

Public frontend keys rely on the included row-level security. Do not put service-role keys in frontend variables.

## Deploy on Netlify

1. Push the repository to your Git provider and import it into Netlify, or deploy using your existing Netlify workflow.
2. Build command: `npm run build`. Publish directory: `dist`. Functions directory: `netlify/functions`. These are declared in `netlify.toml`.
3. Configure the two `VITE_*` values for the frontend build.
4. Configure these server values with **Functions** scope:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_private_service_role_key
GEMINI_API_KEY=your_private_gemini_key
AI_MODEL=your_current_image_capable_model_id
```

The service-role key is used only for server-side AI quota accounting and authenticated account deletion. It must remain private. Change/revoke any key accidentally exposed publicly.

5. Redeploy after environment changes. Add the deployed URL to Supabase's allowed authentication redirects.
6. Test `/food`, `/plan`, `/workouts` and `/progress` by refreshing each URL. `/api/*` maps to functions before the SPA fallback.

Only public environment variables are included in the browser build. Inspect the built assets before deployment if adding new secrets or integrations.

## Optional Gemini AI

Create a Gemini key in Google AI Studio, then put it in the server-side `GEMINI_API_KEY` setting. Choose an image-capable model currently available to your account and set its identifier in `AI_MODEL`.

Free quotas, supported regions, models and service limits change. Confirm the model's current free tier in the official pricing page before enabling it. The application does not activate paid billing. Supabase, Netlify and AI usage can each have their own limits.

Official pricing checked on 21 November 2026 lists Supabase Free with a 500 MB database, 1 GB file storage, and pausing after a week of inactivity. Netlify's current Free plan lists 300 monthly credits, shared by usage including hosting/builds/functions. Legacy Netlify plans can differ. Gemini has model-dependent free allowances; no model or quota is hardcoded here. Confirm your actual dashboard limits before deploying.

The endpoint is `/api/analyze-food`. It:

- Verifies the Supabase access token.
- Requires explicit consent and validates request size and image signatures.
- Sends only the meal photo/description to Gemini.
- Applies a durable application quota of 15 requests per user per Colombo calendar day and a minimum 10-second spacing. This is an app limit, not a claim about Google's free quota.
- Uses a 20-second provider timeout and validates returned JSON and calorie ranges.
- Returns an editable suggestion; it never inserts a meal automatically.

Free-provider data handling may permit using submitted content to improve products. The UI explains this before upload. Client-side image resizing removes source metadata by drawing and re-encoding the photo. HEIC is not accepted in this version; select or convert to JPEG, PNG or WebP.

Local drafts never synchronize their embedded image data. Cloud retention is a separate opt-in upload to the private `meal-photos` bucket. Users can remove retained cloud photos from the account panel. The current UI does not display cloud photo history; photos are optional supporting storage.

To test functions locally, use Netlify Dev with the server variables configured; Vite alone has no AI backend. With missing keys, quota errors or offline connectivity, manual logging remains available.

## Offline data and synchronization

IndexedDB separates guest and authenticated owners. Local changes are immediate and durable; authenticated changes add versioned operations to an outbox.

The `apply_change` SQL function serializes competing changes, checks ownership, detects version conflicts and records operation IDs. Retries cannot create duplicate records. Deletions use tombstones so older remote data cannot resurrect a meal.

The server version wins a conflict deterministically, while the latest local version is kept in a recovery record. The account panel lets the user compare, restore the local edit as a new change, or keep the server version.

Sign-out hides the previous account's local records and leaves unsynced work available when that same account signs in again. Authentication and cloud synchronization require connectivity. Importing guest data is explicit and skips previously imported record IDs.

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

Current verification: 23 calculation/storage/PostgreSQL/endpoint tests and 12 Chromium browser workflows pass. Responsive checks cover every screen at 320, 360, 390, 768, 1024 and 1440 pixels, plus short landscape viewports. Browser tests generate desktop and phone screenshots locally in `artifacts/`. Physical iPhone/Safari installation and live provider connections still need validation on your deployment.

Live Supabase authentication, remote storage, real Gemini responses, free-tier eligibility and a public Netlify deployment require your accounts and configuration. Local PostgreSQL tests cannot prove a separately configured production project's policies; run the same ownership checks against that project before real use.

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
