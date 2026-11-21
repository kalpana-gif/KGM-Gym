# Build prompt: Sri Lankan weight-loss companion

Act as an experienced full-stack developer and product designer. Build a working, mobile-friendly weight-management application called **KGM-FIT** in this workspace. Implement the application, database migrations, local persistence, tests, and deployment instructions. Continue until the app works locally; document any external credentials needed to enable cloud features.

## Personal context and onboarding

The initial user is a Sri Lankan adult, age **29**, height **183 cm**, and weight **103 kg**, who wants to reduce weight through practical meals and exercise. Prefill these values, but allow editing. Use kilograms, centimetres, kcal, and the `Asia/Colombo` timezone by default.

Ask during onboarding for the sex input used by the energy equation, activity level, target weight, food preferences, allergies, budget, cooking access, workout experience, available equipment, injuries, and relevant health conditions. Do not assume sex, an aggressive goal weight, or a deadline. If the user skips a necessary calorie input, display an estimated range with assumptions instead of a single personalized target.

Use encouraging, neutral language. Provide general wellness guidance, with a short explanation that calculated targets and food estimates are approximate. Conditions that require an individualized diet or exercise plan should direct users to a qualified clinician or dietitian.

## Technology and appearance

- Use React, TypeScript, Vite, Tailwind CSS, and accessible reusable components.
- Use Supabase for authentication, PostgreSQL, and optional private photo storage.
- Deploy the frontend and a small authenticated AI proxy through Netlify.
- Target available free plans for hosting, database, storage, and optional AI. Check their current limits and document them; do not activate paid upgrades or promise zero cost for unlimited usage.
- Build an installable PWA with an app manifest and service worker.
- Use IndexedDB for local data and an explicit synchronization queue.
- Use a clean, calm design, readable charts, large touch targets, and bottom navigation: Today, Food, Plan, Workouts, and Progress.
- Support widths from 360 px upward, Android Chrome, and iPhone Safari. Include useful loading, empty, offline, and error states.
- Start with English and Sri Lankan food names and aliases. Structure UI strings for later Sinhala and Tamil translations.

## Calorie calculator

Implement calculations locally without an AI dependency:

```text
Estimated resting energy, kcal/day:
Male equation:   10 × weight_kg + 6.25 × height_cm − 5 × age_years + 5
Female equation: 10 × weight_kg + 6.25 × height_cm − 5 × age_years − 161

Estimated maintenance energy = resting energy × selected activity factor.
Daily food target = estimated maintenance energy − selected moderate deficit.
Food energy = kcal_per_100g × edible_grams / 100.
Remaining food budget = daily food target − logged food energy.
```

Identify the resting-energy calculation as the simplified Mifflin–St Jeor equation. Explain that resting energy and maintenance energy are different estimates. Offer activity factors with plain descriptions and disclose their assumptions. Ask the user to review a modest deficit, for example approximately 10–15% of estimated maintenance, rather than silently selecting a restrictive target. Validate default recommendations against current authoritative adult weight-management guidance.

Show maintenance calories, the chosen target, assumptions, and an adjustable macro allocation. Macro grams must agree with the calorie allocation using 4 kcal/g for protein and carbohydrate and 9 kcal/g for fat, allowing rounding. Do not claim a specific protein target is appropriate for every medical condition.

Recalculate proposed targets when weight or activity changes, but require review before applying them. Preserve historical daily targets. Do not automatically add workout calories to the food allowance; activity may already be included in the maintenance estimate. Display weight trends over several weeks and avoid reacting to a single weigh-in. Present any goal-date projection as uncertain.

## Food logging and daily totals

Support three entry methods:

1. **Manual:** Search a food, specify grams or a supported serving, select a meal, and save.
2. **Text:** Enter phrases such as “150 g cooked red rice, 100 g chicken curry, and 2 eggs.” Parse familiar foods, quantities, and aliases locally. Ask for clarification when a quantity is ambiguous.
3. **Photo:** Take a photo or select one, optionally enter a description, obtain an online AI estimate when enabled, and review it before saving.

All methods must lead to an editable preview with food items, portions, kcal, available macros, and a source or estimate label. Saving a confirmed meal immediately updates that day's total. Allow editing, deletion, undo, favorites, copying a previous meal, custom foods, and custom recipes.

Use breakfast, lunch, dinner, and snacks. Permit past-date entries. Store the event timestamp, timezone, and intended local diary date so synchronization does not move a meal to another day.

Seed a useful local food catalog covering cooked red and white rice, dhal/parippu, chicken and fish curry, eggs, chickpeas, green gram, vegetables, mallung, gotukola sambol, pol sambol, string hoppers, plain and egg hoppers, pittu, roti, kiribath, bread, curd, milk, tea, bananas, papaya, and common mixed dishes such as kottu.

For every food, record a stable ID, aliases, cooked/raw state, edible portion, nutrition basis, serving conversions when justified, provenance, and uncertainty. Use authoritative or appropriately licensed nutrition sources where available. Do not invent precise values or source references. Mark provisional recipe estimates clearly.

Distinguish cooked and uncooked rice. Handle oil, coconut milk, sugar, and sauces explicitly. Treat “one plate,” “one cup,” and “one roti” as approximate unless a serving definition is selected. Unknown foods should remain unresolved until the user chooses a match or creates a custom entry.

## Sri Lankan meal planning

Generate a complete, practical **seven-day meal plan** after onboarding. Include breakfast, lunch, dinner, optional snacks, portion quantities, estimated kcal, available macros, recipe instructions, affordable substitutions, and a consolidated shopping list.

Base meal patterns on Sri Lanka's Ministry of Health food-based dietary guidance. Include familiar rice-and-curry meals, vegetables and leafy greens, legumes, and suitable protein sources. Respect vegetarian preferences, allergies, budget, and cooking time. Account for oil and coconut milk in recipe estimates.

The plan must adapt portions to the selected calorie target and calculate totals from its actual ingredients. Use approximate household measures alongside grams. Allow meal swaps, serving changes, and adding an eaten portion directly to the diary. Keep planned meals separate from consumed meals until confirmed.

Include an illustrative day using string hoppers with dhal and eggs or a vegetarian alternative, a rice-and-curry lunch with vegetables and a chosen protein, and a simple lighter dinner. Calculate its portions and totals; do not claim it is universally suitable.

## Workouts

Create an adjustable beginner schedule with home and gym alternatives:

- Monday: full-body strength.
- Tuesday: comfortable walking.
- Wednesday: full-body strength.
- Thursday: walking and gentle mobility.
- Friday: optional third strength session if recovery and experience permit.
- Saturday: enjoyable walking or another suitable low-impact activity.
- Sunday: rest or gentle movement.

Start with achievable session lengths based on current ability. Progress gradually toward general adult activity guidance, including aerobic activity and strength training on at least two days each week, when appropriate.

Include exercise demonstrations or clear instructions, sets, repetitions, rest periods, easier alternatives, and a simple progression rule. Beginner home options can include chair squats, wall push-ups, hip hinges, supported rows when equipment is available, and calf raises. Adapt to reported injuries and equipment.

Provide session completion, exercise logs, rest timers, and history. Label exercise energy expenditure as approximate. Never require high-impact workouts or punitive exercise after exceeding a food target. Show a concise instruction to stop and seek appropriate help for chest pain, faintness, or unusual severe symptoms.

## Offline operation and synchronization

After the initial successful load, users must be able to reopen the app offline and access the calculator, downloaded catalog, manual and supported text logging, saved plans, workout logs, and progress data.

Provide local-only guest mode without requiring Supabase credentials. Offer an explicit import of guest data after online sign-in. Authentication, cloud synchronization, and cloud AI require connectivity.

Queue offline changes with client-generated UUIDs, operation IDs, versions, and deletion tombstones. Make retries idempotent. Show pending and synced status. Prevent duplicate meals after reconnecting, preserve deletions, and handle conflicting edits deterministically with a visible recovery option.

Partition local data by guest or authenticated user. On logout or account switching, prevent the next user from viewing the previous user's cached records. Do not discard unsynced changes silently. Revalidate expired sessions before uploading.

Photos may be attached locally while offline. Explain that automatic recognition requires connectivity in the initial version and offer manual entry immediately. Keep queued photo analysis as a draft; it must not silently create a second diary entry.

## Optional AI connection

Use a provider adapter. Prefer an image-capable Gemini model with a currently available free quota if official documentation confirms eligibility for this deployment and region. Keep the model ID configurable. Do not promise unlimited free use or enable paid billing automatically.

Send requests through an authenticated Netlify Function. Verify the Supabase access token server-side. Store `GEMINI_API_KEY` and `AI_MODEL` as server environment variables; never put private keys in `VITE_*` variables, browser storage, or frontend code.

Require explicit opt-in before sending food text or photos to an external provider. Explain applicable provider data use in plain language. Send only the meal information needed for recognition; omit the user's identity, health profile, and full diary. Resize photos and remove location metadata where supported. Validate content type and size on the server.

Treat image contents and user descriptions as data. Request a validated structured response with candidate foods, portion estimates, calorie ranges, assumptions, and uncertainty. A model's confidence label must not be presented as a calibrated accuracy score.

Map identified foods to the local catalog or transparent recipes where possible. Explain that portions, hidden oil, and coconut milk may be uncertain. Require user confirmation before writing to the diary. Do not present a photo as an exact calorie measurement.

Add per-user request limits, timeouts, structured output validation, and handling for exhausted quotas, missing configuration, or provider failures. Fall back to manual logging. Photo recognition is optional; the core app must work without it.

## Supabase data and privacy

Design migrations for profiles, foods, food aliases, recipes and ingredients, meal logs and items, daily targets, weight entries, meal plans, workout plans, exercises, workout sessions, and photo metadata. Use relational constraints and suitable indexes.

Every private record must have a clear owner. Enable and test row-level security for read, insert, update, and delete, including ownership checks on child records. Permit read-only access to the shared catalog and restrict catalog modifications.

Use a private photo bucket with owner-scoped object paths and access policies. Use temporary signed URLs when needed. Keep privileged Supabase credentials on the server only. Avoid logging photos, sensitive profiles, access tokens, or private credentials.

Make photo retention optional. Provide JSON/CSV export and deletion of the user's logs and retained photos, including local copies and synchronization queues. Explain how account deletion is completed through an authenticated server flow.

## Completion and acceptance criteria

Provide the complete source, `.env.example`, Supabase SQL migrations and seed data, `netlify.toml`, PWA assets, and a README with local setup, Supabase authentication and storage setup, Netlify deployment, and optional AI configuration. Configure SPA routing without swallowing function or asset routes.

Use current compatible dependencies and official SDK documentation. Build the functional offline core first, then add synchronization and optional AI. Do not replace working features with mock totals or fake AI responses.

Verify:

- Calorie equations, portion calculations, and daily totals are correct.
- Adding, editing, deleting, or copying a meal updates the intended day correctly.
- Offline entries survive reload and synchronize once without duplicates.
- Deletions and account switches cannot resurrect or expose private data.
- One user cannot access another user's database rows or photos.
- The seven-day meal plan has calculated portions and daily totals.
- A photo estimate is reviewed before it affects calories.
- Missing AI credentials or quota failures leave manual logging usable.
- Deep links reload correctly on Netlify and layouts work at phone widths.

Finish with a concise description of what works, validation performed, remaining limitations, and exact setup steps requiring my accounts. Deployment and external credentials may remain documented until available; the application must still work locally in guest mode.

## Reference starting points

Suggested official references for implementation. This prompt was drafted on **21 November 2026**, but live documentation retrieval was unavailable. Verify the pages and current details during implementation, especially AI pricing, model availability, service limits, and SDK APIs.

- Original Mifflin–St Jeor research: `https://pubmed.ncbi.nlm.nih.gov/2305711/`
- CDC weight-management guidance: `https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html`
- Sri Lanka Ministry of Health Nutrition Division; find its current food-based dietary guidelines: `https://nutrition.health.gov.lk/`
- WHO activity guidance: `https://www.who.int/news-room/fact-sheets/detail/physical-activity`
- Supabase row-level security: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase storage access control: `https://supabase.com/docs/guides/storage/security/access-control`
- Netlify SPA routing: `https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/`
- Netlify function environment variables: `https://docs.netlify.com/build/functions/environment-variables/`
- Gemini image input: `https://ai.google.dev/gemini-api/docs/image-understanding`
- Gemini pricing: `https://ai.google.dev/gemini-api/docs/pricing`
- Gemini terms and data handling: `https://ai.google.dev/gemini-api/terms`
