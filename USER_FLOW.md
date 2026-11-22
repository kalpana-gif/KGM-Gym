# KGM-FIT user flow

This flow describes the implemented application. It starts on Today by default; an existing deep link opens its corresponding page. Sign-in and target setup are optional, and manual food logging works before a calorie target is confirmed.

## Main journey

```mermaid
flowchart TD
    Open["Open KGM-FIT"] --> Home["Today · or the requested page"]
    Home --> Setup["Your preferences"]
    Setup --> Details["Review body details, food preferences and movement needs"]
    Details --> Ready{"Calorie inputs complete<br/>and target supported?"}
    Ready -->|Yes| Confirm["Review and confirm daily target"]
    Ready -->|No| Range["Save details with estimated range"]
    Confirm --> Home
    Range --> Home
    Home --> Food["Food · log and manage meals"]
    Home --> FoodHistory["History · weekly calories and daily meals"]
    Home --> Plan["Plan · view seven days of meals"]
    Home --> Workouts["Workouts · follow and log movement"]
    Home --> Progress["Progress · log weight and view trends"]
    Home --> Account["Account · optional sign-in and data controls"]
    Food --> Diary["Confirmed entries update daily totals"]
    Plan --> Eaten["Confirm an eaten meal"]
    Eaten --> Diary
    Workouts --> Session["Save completed session"]
    Progress --> Weight["Save a dated weigh-in"]
    Diary --> Home
    Diary --> FoodHistory
    Session --> Home
    Weight --> Progress
```

All six main pages remain available through the navigation. The shared diary-date selector controls the day being viewed; the meal editor and weigh-in form also allow choosing their own entry date. History groups saved meals into Monday–Sunday weeks, shows daily calories and opens a selected day's meals for review and editing.

## Starting point and target review

```mermaid
flowchart TD
    Start["Today setup banner or Your preferences"] --> Profile["Review age, height and weight"]
    Profile --> Inputs["Select energy-equation input and activity level"]
    Inputs --> Preferences["Review goal weight, deficit, macros,<br/>food preferences, allergies, budget,<br/>cooking access, equipment and health details"]
    Preferences --> Valid{"Details valid?"}
    Valid -->|No| Fix["Show validation message"]
    Fix --> Profile
    Valid -->|Yes| Target{"Supported target available?"}
    Target -->|No| Estimates["Show range or individual-review message"]
    Estimates --> SaveDetails["Save profile and today's weight"]
    Target -->|Yes| Review["Display proposed calorie target and macros"]
    Review --> Approve["User checks target-review confirmation"]
    Approve --> SaveTarget["Save profile, today's weight<br/>and target effective from today"]
    SaveDetails --> Return["Return to previous page"]
    SaveTarget --> Return
```

Initial body details are prefilled from the project brief. The equation input and activity level start unselected. Saving a new target preserves earlier target records. Saving a weigh-in later does not automatically recalculate the confirmed calorie target.

## Meal entry and review

```mermaid
flowchart TD
    Log["Log a meal from Today or Food"] --> Method{"Entry method"}
    Method -->|Search foods| Search["Find a catalog food and add it"]
    Method -->|Type a meal| Parse["Parse known foods locally"]
    Parse --> Unknown{"Unmatched foods?"}
    Unknown -->|Yes| Resolve["Choose a catalog match<br/>or explicitly remove each unmatched entry"]
    Unknown -->|No| Review["Review foods, grams, servings and nutrition"]
    Resolve --> Review
    Search --> Review
    Method -->|Meal photo| Photo["Choose photo and optional description"]
    Photo --> Draft["Optionally save a local photo draft"]
    Draft --> Reopen["Reopen draft later"]
    Reopen --> Photo
    Photo --> Gate{"Online, consent given<br/>and AI configured?"}
    Gate -->|No| Fallback["Use manual entry or keep the draft"]
    Fallback --> Search
    Gate -->|Yes| Analyze["Request AI estimate"]
    Analyze --> Result{"Estimate returned?"}
    Result -->|No| Fallback
    Result -->|Yes| Suggestions["Review suggested foods, ranges and assumptions"]
    Suggestions --> Match["Fill catalog matches and editable AI foods;<br/>check portions, names and calories"]
    Match --> Review
    Review --> Entry["Set meal name, meal slot and diary date"]
    Entry --> Retain{"Retain photo in private cloud storage?"}
    Retain -->|No| Confirm["Confirm and save meal"]
    Retain -->|Yes| Upload["Upload with sign-in and connectivity"]
    Upload --> Uploaded{"Upload succeeded?"}
    Uploaded -->|Yes| Confirm
    Uploaded -->|No| Retry["Retry or turn photo retention off"]
    Retry --> Retain
    Confirm --> Saved["Save locally and update the entry date's totals"]
```

Text parsing and catalog calculations run locally. Photo AI works for guests without sign-in. It fills the review with catalog matches or editable AI nutrition snapshots, shows an approximate calorie range and preserves the original estimate. The user checks foods, grams, meal name, slot and date before confirming. A confirmed meal updates the diary totals; uploading a photo or requesting an estimate alone does not log anything. Saving an entry from an opened photo draft removes that draft.

Existing meals open from the Today diary into the same editor. The user can update the meal, copy the reviewed contents to another selected date, or delete it. Deleted meals can be restored from **Food → Recently deleted meals**. The Food page also supports favorites, custom foods, and recipes calculated from ingredient quantities and finished batch weight.

## Meal plan and movement

```mermaid
flowchart TD
    Plan["Open Plan"] --> HasTarget{"Confirmed calorie target exists?"}
    HasTarget -->|No| Calculator["Review calculator and confirm a target"]
    Calculator --> Plan
    HasTarget -->|Yes| Compatible{"Preferences allow a plan?"}
    Compatible -->|No| Adjust["Adjust food preferences"]
    Adjust --> Plan
    Compatible -->|Yes| Week["Calculate seven days from the selected diary date"]
    Week --> Day["Choose a day and review meals"]
    Day --> Swap["Optionally save calorie-equivalent food swaps"]
    Swap --> Day
    Day --> Portion["Optionally change portion multiplier"]
    Portion --> Eat["I ate this · add to diary"]
    Eat --> Totals["Save actual meal and update daily totals"]
    Week --> Shopping["Open ingredient shopping list"]

    Workout["Open Workouts"] --> Schedule["Choose day and review equipment-based schedule"]
    Schedule --> Injury{"Injury reported?"}
    Injury -->|Yes| Guidance["Show review guidance<br/>and pause automatic strength prescriptions"]
    Injury -->|No| Movement["Follow exercises or walking / recovery day"]
    Guidance --> Log["Record completed movement"]
    Movement --> Timer["Use rest timer; mark exercises,<br/>sets and repetitions"]
    Timer --> Log
    Log --> Save["Enter minutes and save session"]
    Save --> History["Session appears in movement history"]
```

Browsing a plan, changing a swap, or opening the shopping list does not count food as eaten. The **I ate this** action explicitly saves a meal. The shopping list uses the current seven-day plan and saved swaps; temporary portion multipliers affect the meal card and logged meal.

## Progress

```mermaid
flowchart TD
    Progress["Open Progress"] --> Trends["View weight trend, logged food energy<br/>and days with meal entries"]
    Progress --> Entry["Enter weight and date"]
    Entry --> Save["Save or replace that date's weigh-in"]
    Save --> Today{"Entry dated today?"}
    Today -->|Yes| Profile["Update weight in an existing profile"]
    Today -->|No| History["Update weight history"]
    Profile --> History
    History --> Trends
    Trends --> Optional["Optionally reopen Your preferences"]
    Optional --> Review["Explicitly review and confirm a revised target"]
```

## Optional account, backup and recovery

```mermaid
flowchart TD
    Account["Open Account and data"] --> Connected{"Already signed in?"}
    Connected -->|No| Available{"Cloud authentication configured?"}
    Available -->|No| Device["Continue on this device"]
    Available -->|Yes| Email["Enter email and request sign-in link"]
    Email --> Sent{"Request succeeded?"}
    Sent -->|No| Error["Show error and allow retry"]
    Error --> Email
    Sent -->|Yes| Inbox["Check email · resend after countdown if needed"]
    Inbox --> Link["Open newest link on the same device"]
    Link --> Valid{"Link valid?"}
    Valid -->|No| Email
    Valid -->|Yes| SignedIn["Open signed-in account panel"]
    Connected -->|Yes| SignedIn
    SignedIn --> Verify["Verify session with Supabase"]
    Verify --> Pull["Load existing account records"]
    Pull --> Copy["Automatically import eligible device diary once"]
    Copy --> AccountDiary
    AccountDiary --> Local["Save changes locally"]
    Local --> Online{"Online?"}
    Online -->|No| Queue["Keep changes queued on this device"]
    Queue -->|Reconnect| Sync["Synchronize automatically or use Sync now"]
    Online -->|Yes| Sync
    Sync --> Result{"Backend request succeeded?"}
    Result -->|No| Retry["Show error and retry automatically"]
    Retry --> Sync
    Result -->|Yes| Conflict{"Conflicting edit?"}
    Conflict -->|No| BackedUp["Cloud backup updated"]
    Conflict -->|Yes| Compare["Use server version;<br/>preserve local version for comparison"]
    Compare --> Choice{"User recovery choice"}
    Choice -->|Restore my local edit| NewChange["Queue local edit as a new change"]
    NewChange --> Sync
    Choice -->|Keep server version| Dismiss["Dismiss recovery record"]
    SignedIn --> SignOut["Sign out · open a fresh guest diary"]
```

Guest and signed-in diaries use separate local owners. A verified account automatically receives eligible entries from its device's guest diary, which is then linked to that account. Signing out opens a fresh guest diary, hides account records and preserves unsynced account work for the same account's next sign-in. Local photo drafts are excluded from guest import and cloud synchronization. Signed-in changes synchronize automatically; the app also refreshes from Supabase every minute and when connectivity or foreground access returns. The account panel shows pending work, backend errors and the last successful sync.

The account panel also provides JSON export and a meal-history CSV, removal of retained cloud photos, and permanent guest-diary or account deletion after typing **DELETE**. JSON exports can include local photo drafts.

## Implementation references

- `src/App.tsx`: navigation, selected diary date, dialogs, account switching and automatic synchronization.
- `src/components/ProfileEditor.tsx`: profile fields, calculation review and target confirmation.
- `src/components/FoodComposer.tsx`: manual/text/photo entry, service status, draft handling and meal confirmation.
- `src/lib/ai.ts`: guest AI request, unique photo-food matching and editable estimated nutrition snapshots.
- `src/pages/Today.tsx` and `src/pages/Food.tsx`: diary entry points, catalog tools and deleted-meal recovery.
- `src/pages/History.tsx`: weekly calorie totals, daily meals and historical diary editing.
- `src/pages/Plan.tsx`: calculated plans, swaps, shopping list and eaten-meal confirmation.
- `src/pages/Workouts.tsx`: exercise completion, timers and session logging.
- `src/pages/Progress.tsx`: weigh-ins, profile-weight updates and trend views.
- `src/components/AccountPanel.tsx`: email sign-in, automatic synchronization status, retry, conflicts, exports and deletion.
