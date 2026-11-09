# RECLAIM --- Engineering Implementation Plan

**Version:** 1.0\
**Prepared:** 7 November 2026\
**Product:** RECLAIM --- "Take back your attention. Rebuild your mind."\
**Target:** Android-first, students and working professionals\
**Repository:** `reclaim-starter/`\
**Implementation partner:** Claude Code

------------------------------------------------------------------------

## 0. Instructions for Claude Code

You have access to this repository. Before changing anything:

1.  Read this plan completely.
2.  Read every existing file under `docs/`, `database/`, `mobile/`, and
    `backend/`.
3.  Inspect the repository and report the actual current state. Do not
    assume files are complete because they exist.
4.  Create a `IMPLEMENTATION_STATUS.md` checklist and update it as work
    is completed.
5.  Implement in the phases below, in order. Do not try to implement the
    entire product in one pass.
6.  Do not delete or overwrite existing product requirements without
    explaining the reason.
7.  Do not fabricate working features, usage metrics, AI insights, or
    test results.
8.  Run formatting, lint, type-check, unit tests, and Android builds at
    the end of each applicable phase. Fix failures before proceeding.
9.  Keep dependencies compatible with the exact React Native, Android
    Gradle Plugin, Gradle, Kotlin, JDK and Node versions selected. Pin
    versions and commit lockfiles.
10. If a prerequisite is missing or a command fails because of the local
    environment, stop that environment-dependent step, document the
    exact error and remediation, and continue only with tasks that can
    be completed safely.
11. Never add secrets, API keys, signing keys, database passwords, or
    personal data to source control.
12. Prefer small, reviewable commits. Do not claim a phase is complete
    until its acceptance criteria pass.

**First response expected from Claude Code:** repository audit,
prerequisite audit, gaps found, proposed version matrix, and Phase 1
task breakdown. Do not begin a broad rewrite before presenting this
audit.

------------------------------------------------------------------------

# 1. Product vision and boundaries

## 1.1 Vision

RECLAIM helps people use their attention intentionally by: - making
user-selected distracting app usage visible; - helping users notice
repetitive checking and extended sessions; - introducing optional,
respectful friction at useful moments; - supporting intentional focus
sessions; - offering short, high-quality critical-thinking exercises; -
helping users reflect on progress without shame or manipulation.

The product succeeds when users gain more agency and eventually need
RECLAIM less.

## 1.2 Target users

**Students (18--25):** want to study consistently, reduce unwanted
social/video app use, and improve reasoning and comprehension practice.

**Working professionals (22--35):** want fewer context switches, more
sustained work, and more intentional breaks.

Do not label users as addicted, lazy, disordered, or cognitively
impaired. Use neutral language such as "selected apps," "unwanted
usage," "focus interruption," and "practice."

## 1.3 Product principles

1.  Agency over shame.
2.  Privacy by default and data minimization.
3.  Clear explanations for permissions and interventions.
4.  Monitoring is optional; focus and cognitive exercises must work
    without it.
5.  No reading messages, notifications, screen contents, keystrokes, or
    browsing contents.
6.  No medical diagnosis or claims that exercises restore intelligence,
    treat ADHD, or reverse cognitive decline.
7.  No coercive blocking, dark patterns, punitive streak loss, or
    manipulative urgency.
8.  Measure outcomes separately: app usage, focus behavior, exercise
    performance, and self-reported usefulness are different things.
9.  No ML model until there is enough consented, quality outcome data to
    justify it.

------------------------------------------------------------------------

# 2. Existing repository audit --- known starting point

The provided ZIP is a **starter**, not a runnable production repository.
It contains useful UI and domain examples but lacks generated project
manifests and complete wiring.

## 2.1 Existing files to preserve and improve

### Product and design docs

-   `docs/PRODUCT_SPEC.md`
-   `docs/UX_SCREENS.md`
-   `docs/API_CONTRACT.md`
-   `docs/PRIVACY_AND_PLATFORM.md`

### Database

-   `database/schema.sql`

The SQL defines nine initial tables: - `users` - `user_preferences` -
`user_goals` - `tracked_apps` - `app_usage_daily` - `focus_sessions` -
`cognitive_exercises` - `exercise_attempts` - `interventions` -
`consent_records`

Note: the current schema actually defines **ten** tables, not nine.
Ensure documentation uses the correct count.

### Mobile UI and native bridge examples

-   `mobile/App.tsx`
-   `mobile/src/screens/HomeScreen.tsx`
-   `mobile/src/screens/FocusScreen.tsx`
-   `mobile/src/screens/TrainScreen.tsx`
-   `mobile/src/screens/InsightsScreen.tsx`
-   `mobile/src/screens/ProfileScreen.tsx`
-   `mobile/src/theme/tokens.ts`
-   `mobile/src/services/usageStats.ts`
-   `mobile/android/app/src/main/java/com/reclaim/UsageStatsModule.kt`

### Backend outline

-   `backend/src/main.ts`
-   `backend/src/app.module.ts`
-   `backend/.env.example`

## 2.2 Known gaps that must be addressed

1.  There is no root `package.json`, lockfile, workspace, or complete
    React Native Community CLI project.
2.  There is no `mobile/package.json`, generated `android/` project,
    Gradle wrapper, manifest, MainApplication registration, or build
    configuration.
3.  The existing Kotlin module is an example and is not registered with
    React Native.
4.  The usage bridge returns package-level foreground duration but does
    not filter to user-selected packages itself.
5.  The current bridge does not implement reliable app opening counts.
    Do not invent `openCount` from `queryUsageStats`; implement a
    separately tested event-based calculation or make the field
    nullable/unsupported.
6.  The bridge must re-check Usage Access after the app resumes from
    Android Settings.
7.  The focus timer is in-memory only, runs only while the app is
    active, and is not persisted to the backend.
8.  The cognitive exercise is hardcoded in the screen. It must move into
    typed content/domain data and later be served by the API.
9.  Insights are placeholders. Do not display fake sample metrics as
    real usage.
10. Profile privacy controls are descriptive placeholders, not
    functional controls.
11. Backend has no package manifest, database connection, migrations,
    auth, controllers, services, validation DTOs, or tests.
12. `main.ts` CORS configuration defaults to an empty origin list.
    Configure it explicitly for development and production; do not
    silently open it to all origins.
13. API contract and schema need reconciliation: authentication,
    onboarding, tracked-app selection, exercise content, consent,
    deletion/export, idempotency, and ownership enforcement must be
    specified.
14. Database schema needs migration management, updated-at behavior,
    deletion semantics, indexes, constraints, and a strategy for
    sensitive data separation.
15. No test suite, CI, Docker Compose, release signing setup, crash
    reporting, or deployment pipeline exists.

Claude Code must verify these gaps against the actual checkout before
acting.

------------------------------------------------------------------------

# 3. Prerequisites and developer environment

## 3.1 Required local tools

  -------------------------------------------------------------------------
  Prerequisite      Required baseline Purpose             Current known
                                                          status
  ----------------- ----------------- ------------------- -----------------
  Windows 10/11     Supported current Local development   Assumed; verify
  64-bit            build                                 

  Node.js           **24.15+ LTS      React Native        User has 20.11.1;
                    recommended**     tooling and Nest    upgrade
                                      CLI generators      

  npm               Bundled with Node Package manager     User has 10.2.4;
                                                          will change with
                                                          Node

  JDK               **17**            Android/Gradle      `java` not
                                      build               recognized;
                                                          install

  Android Studio    Current stable    SDK manager and     Not confirmed
                                      emulator            

  Android SDK       API 35 as         Android compile     Not confirmed
  Platform          required by       target              
                    current RN                            
                    environment                           
                    guide; verify                         
                    current RN                            
                    release docs                          

  Android SDK Build 36.0.0 or version Android build       Not confirmed
  Tools             required by                           
                    selected RN                           
                    template                              

  Android SDK       Latest stable     SDK tooling         Not confirmed
  Command-line                                            
  Tools                                                   

  Android SDK       Latest stable     Device connection   Not confirmed
  Platform Tools    (`adb`)                               

  Android           API 35 or         Emulator testing    Not confirmed
  Emulator + system compatible                            
  image             current image                         

  Git               Current           Version control     User has 2.44.0

  VS Code           Current           Editor              Installed

  Claude Code       Current and       Implementation      User says
                    authenticated     agent               installed

  PostgreSQL        Current supported Backend persistence Not confirmed
                    release (16/17/18                     
                    as compatible)                        

  Docker Desktop    Optional but      Local PostgreSQL    Not confirmed
                    recommended       via Compose         

  Physical Android  Android 10+       Real UsageStats     Not confirmed
  phone             recommended for   permission/device   
                    broad testing     validation          
  -------------------------------------------------------------------------

**Important version policy:** React Native and Android build tooling
change. Before scaffolding, Claude Code must check the current official
React Native Windows/Android environment guide and use a supported
stable React Native release. Pin exact versions in manifests and
lockfiles. Do not use alpha, nightly, or canary dependencies.

Current official references: - React Native environment setup:
https://reactnative.dev/docs/set-up-your-environment - React Native
releases: https://reactnative.dev/releases/overview - Node.js downloads:
https://nodejs.org/en/download/ - NestJS first steps/prerequisites:
https://docs.nestjs.com/first-steps - Android Studio:
https://developer.android.com/studio - Android UsageStatsManager:
https://developer.android.com/reference/android/app/usage/UsageStatsManager

The React Native setup guide currently requires Node 22.11.0 or newer
and recommends JDK 17. Current NestJS CLI generators have a higher Node
requirement; Node 24.15+ LTS is selected to satisfy both without
maintaining separate Node installations.

## 3.2 Windows environment variables

After installing Android Studio, find the actual SDK path in: **Android
Studio → Settings → Languages & Frameworks → Android SDK**

Typical default: `%LOCALAPPDATA%\Android\Sdk`

Set user environment variables: - `JAVA_HOME` → JDK 17 installation
directory - `ANDROID_HOME` → Android SDK directory

Add to user `Path`: - `%JAVA_HOME%\bin` -
`%ANDROID_HOME%\platform-tools` - `%ANDROID_HOME%\emulator` -
`%ANDROID_HOME%\cmdline-tools\latest\bin`

Close and reopen VS Code after changes.

## 3.3 Verify prerequisites in PowerShell

Run from a new VS Code terminal:

``` powershell
node -v
npm -v
java -version
javac -version
git --version
echo $env:JAVA_HOME
echo $env:ANDROID_HOME
adb --version
adb devices
```

Expected: - Node 24.15+. - Java/Javac 17.x. - Git available. -
`JAVA_HOME` points to JDK 17. - `ANDROID_HOME` points to SDK. - `adb`
prints its version. - `adb devices` lists an emulator or connected phone
(device may show `unauthorized` until accepted).

## 3.4 Physical Android phone setup

1.  Enable Developer Options.
2.  Enable USB debugging.
3.  Connect with a data-capable USB cable.
4.  Accept the computer authorization prompt on the phone.
5.  Verify `adb devices` shows `device`, not `unauthorized`.
6.  Test Usage Access manually in Android Settings after the feature is
    implemented.

Emulator testing is useful for UI and API flows, but real-device testing
is mandatory for Usage Access, OEM behavior, battery behavior,
permission revocation, and event availability.

## 3.5 Backend local prerequisites

Preferred local setup: - PostgreSQL in Docker Compose. - A dedicated
development database/user. - `.env` copied from `.env.example`. - A
migration tool selected and documented (recommend Prisma or TypeORM;
choose one, do not mix). - Never commit real `.env` files.

Docker is optional if PostgreSQL is installed locally.

------------------------------------------------------------------------

# 4. Architecture decisions

## 4.1 Initial architecture: modular monolith

Do not create microservices for the MVP. Use: - React Native mobile
client; - Kotlin native module for Android Usage Access; - NestJS
backend modular monolith; - PostgreSQL relational database; - optional
local Redis only when queues/cache become necessary; - deterministic
rules-based intervention engine; - static/versioned cognitive exercise
content; - LLM coach only after deterministic product flows work and
safety controls exist.

## 4.2 Proposed repository structure

Preserve existing docs and migrate source into this target structure.
Adjust only when the chosen CLI template requires it.

``` text
reclaim-starter/
├── README.md
├── IMPLEMENTATION_PLAN.md
├── IMPLEMENTATION_STATUS.md
├── .gitignore
├── .editorconfig
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── UX_SCREENS.md
│   ├── API_CONTRACT.md
│   ├── PRIVACY_AND_PLATFORM.md
│   ├── ARCHITECTURE.md
│   ├── DATA_DICTIONARY.md
│   └── ADR/
├── database/
│   ├── schema.sql
│   └── seed/
├── mobile/
│   ├── package.json
│   ├── app.json
│   ├── tsconfig.json
│   ├── android/
│   └── src/
│       ├── app/
│       ├── navigation/
│       ├── components/
│       ├── features/
│       │   ├── onboarding/
│       │   ├── usage/
│       │   ├── focus/
│       │   ├── cognitive/
│       │   ├── coach/
│       │   ├── insights/
│       │   └── profile/
│       ├── native/
│       ├── services/
│       ├── state/
│       ├── theme/
│       ├── types/
│       └── utils/
├── backend/
│   ├── package.json
│   ├── nest-cli.json
│   ├── prisma/ or selected-migration-directory/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── common/
│       ├── config/
│       ├── database/
│       └── modules/
│           ├── auth/
│           ├── users/
│           ├── onboarding/
│           ├── goals/
│           ├── consent/
│           ├── usage/
│           ├── focus/
│           ├── cognitive/
│           ├── interventions/
│           ├── insights/
│           └── privacy/
├── infra/
│   ├── docker-compose.yml
│   └── postgres/
└── .github/workflows/
```

Do not create empty modules just to match this tree. Add a module when
its phase begins.

## 4.3 Mobile technology

-   React Native Community CLI (not Expo Go), TypeScript.
-   Native Android code in Kotlin.
-   React Navigation for navigation.
-   React Native Safe Area Context.
-   React Native Screens.
-   React Native Gesture Handler only if needed.
-   A small state solution (Context + reducer initially; avoid
    unnecessary state libraries).
-   API client with typed DTOs.
-   Secure token storage using Android Keystore-backed storage via a
    maintained library.
-   Local persistence for focus session recovery and onboarding draft;
    do not persist raw usage events unnecessarily.
-   React Native Testing Library and Jest/Vitest-compatible test setup
    according to chosen template.

The existing native UsageStats module requires a native development
build. It cannot run in Expo Go. Use Community CLI for this native-first
Android product.

## 4.4 Backend technology

-   NestJS + TypeScript.
-   PostgreSQL.
-   Prisma (recommended) or TypeORM, selected once.
-   DTO validation with `class-validator` / `class-transformer` if
    compatible with the chosen Nest setup.
-   Authentication: email/password or passwordless email flow; do not
    invent a production auth provider. For initial local alpha,
    implement a clearly marked development auth mode only if needed.
-   Password hashing with Argon2id or bcrypt using safe parameters.
-   JWT access token and refresh-token rotation if using JWT.
-   OpenAPI/Swagger for API documentation.
-   Structured logging; redact tokens and personal data.
-   Rate limiting for auth and write endpoints.
-   Health endpoint.
-   CORS allowlist by environment.
-   Database migrations and seed scripts.
-   Unit and integration tests.

## 4.5 API contract

All routes versioned under `/v1`. Derive authenticated user identity
from the validated session/token, never from a client-supplied `userId`.

Implement in phases: - `GET /health` - `POST /auth/register` and
`POST /auth/login` (or chosen auth flow) - `POST /auth/refresh`,
`POST /auth/logout` - `GET /me` - `PATCH /me/preferences` -
`GET /goals`, `POST /goals`, `PATCH /goals/:id`, `DELETE /goals/:id` -
`GET /tracked-apps` - `PUT /tracked-apps` (replace user's selected
package set transactionally) - `GET /usage/daily?from=&to=` -
`POST /usage/daily/batch` - `POST /focus-sessions` -
`PATCH /focus-sessions/:id` - `GET /exercises/today` -
`POST /exercises/:id/attempts` - `GET /insights/weekly` -
`POST /interventions/:id/feedback` - `GET /privacy/export` -
`DELETE /me`

Requirements: - DTO validation, strict payload limits, pagination where
relevant. - Ownership checks on every user-owned record. - Idempotency
for usage batch uploads and session completion. - UTC timestamps in
storage; date-only usage bucket interpreted in user's timezone. -
Validate package names against the user's selected app list. - Do not
trust client-provided correctness scores; server grades exercise
answers. - Deletion must propagate to all user-owned records and any
queued exports/backups according to documented retention policy.

------------------------------------------------------------------------

# 5. Detailed implementation phases

## Phase 0 --- Repository audit and environment readiness

**Goal:** Make the repository reproducible before adding features.

Tasks: 1. Inspect all existing files and produce
`IMPLEMENTATION_STATUS.md`. 2. Verify Node, npm, JDK, Android Studio,
SDK, Gradle prerequisites, Git, ADB, PostgreSQL/Docker. 3. Record exact
tool versions in `docs/ARCHITECTURE.md`. 4. Create root `.gitignore` for
Node, React Native, Android, Gradle, IDE, build outputs, `.env`, signing
files. 5. Add `.editorconfig` and formatting/lint conventions. 6. Decide
package manager (npm) and keep lockfiles. 7. Create a root README with
exact setup commands. 8. Add a lightweight ADR documenting modular
monolith and native Android approach.

Acceptance criteria: - Prerequisite checklist is truthful and
complete. - No secrets or build artifacts tracked. - `git status` is
clean apart from intended changes. - Setup instructions can be followed
from a clean checkout.

## Phase 1 --- Scaffold a runnable Android app

**Goal:** Turn the UI starter into a real React Native application.

Tasks: 1. Generate a React Native Community CLI TypeScript project
inside `mobile/` using the latest stable supported release (as of
preparation date, use active stable 0.88.x only after verifying official
release status; otherwise use latest active stable). 2. Ensure generated
Android project and Gradle wrapper are complete. 3. Copy/adapt existing
`App.tsx`, screens and theme tokens into the generated app. 4. Configure
application name `RECLAIM` and Android application ID `com.reclaim` (or
documented reverse-domain ID if `com.reclaim` is unsuitable). 5. Set app
display name, launcher icon placeholder, splash screen placeholder and
status/navigation bar colors. 6. Implement proper navigation with five
tabs: Home, Focus, Train, Insights, Profile. 7. Add shared UI
components: button, card, screen container, section heading, loading,
error and empty state. 8. Ensure responsive layout, safe areas, keyboard
behavior, touch targets, screen reader labels and contrast. 9. Add
scripts: `start`, `android`, `lint`, `typecheck`, `test`. 10. Create a
basic smoke test for navigation and screen rendering.

Acceptance criteria: - `npm install` succeeds. - `npm run android`
builds and installs on emulator/phone. - All five tabs navigate. - No
placeholder metrics are presented as real data. - TypeScript, lint and
smoke tests pass. - Debug APK can be built using Gradle.

## Phase 2 --- Onboarding, preferences and consent

**Goal:** Make the app usable without requiring Usage Access.

Screens: 1. Welcome / value proposition. 2. Select priorities: study,
meaningful work, reading, sleep routine, relationships, creative
projects, other. 3. Select preferred focus duration (15/25/45/custom).
4. Explain Usage Access in plain language. 5. Optional monitoring
choice; user can skip. 6. Select tracked apps only after permission is
granted and app usage list is available. 7. Confirm what data is
collected and how to revoke permission. 8. Profile settings for editing
goals and monitoring preference.

Tasks: - Build onboarding state machine and persistence. - Add consent
record with purpose, policy version, granted state and timestamp. - Do
not bundle Usage Access consent with unrelated terms. - User can decline
monitoring and still use focus and cognitive features. - Add a
"monitoring paused" state. - Do not pre-label any app as bad or
distracting. - App inventory access must be limited to the minimum
needed and comply with Android package visibility requirements; do not
request broad installed-app visibility without policy review.

Acceptance criteria: - Onboarding can be completed, skipped where
appropriate, resumed after app restart and edited later. - Monitoring
permission is optional. - User sees a clear explanation before Android
Settings opens. - Consent is recorded locally and later synced
securely. - No app usage is collected before the user grants access and
chooses monitoring.

## Phase 3 --- Android Usage Access native integration

**Goal:** Reliably read user-selected app usage aggregates with explicit
permission.

Existing file:
`mobile/android/app/src/main/java/com/reclaim/UsageStatsModule.kt`

Tasks: 1. Integrate the Kotlin module into the generated Android app
using the registration mechanism supported by the selected React Native
version (ReactPackage / native module interop as appropriate). 2. Ensure
package declaration, source path, namespace and application ID are
consistent. 3. Implement native methods: -
`hasUsageAccess(): Promise<boolean>` -
`openUsageAccessSettings(): Promise<boolean>` -
`getUsageSummary(startMillis, endMillis, selectedPackageNames): Promise<UsageSummary[]>`
4. Filter to selected package names before returning data to JS. 5.
Return a typed result: package name, foreground milliseconds,
date/bucket, source and data completeness metadata. 6. Implement open
counts only if correctly derived from `UsageEvents` transitions. Handle
API-level event names (`ACTIVITY_RESUMED`/`ACTIVITY_PAUSED` on modern
Android and legacy foreground/background event types where relevant).
Pair transitions carefully; do not double count multi-activity apps. 7.
If opening count cannot be calculated reliably, make it nullable and
explain why. Never fake it. 8. Use `UsageStatsManager` safely; handle
null/empty results, time-zone boundaries, current-day partial data,
permission denied, app process restarts and OEM variation. 9. Exclude
RECLAIM itself from distraction metrics unless the user explicitly opts
in. 10. Re-check permission on app resume using `AppState`; settings
permission can be revoked externally. 11. Keep monitoring off when user
disables it. 12. Add native unit/instrumentation tests where feasible
and JS bridge tests with a mocked native module. 13. Document that usage
summaries are estimates/OS aggregates and do not reveal intention or
mental state.

Important Android details: - Usage Access is special app access granted
in system settings, not a normal runtime permission dialog. - Use
`AppOpsManager.OPSTR_GET_USAGE_STATS` to check permission. - Open
`Settings.ACTION_USAGE_ACCESS_SETTINGS`. - Query only requested time
ranges and selected apps. - `queryUsageStats` returns aggregate data;
`queryEvents` is a different source and event availability/history is
limited. - Never collect notifications, message contents, screenshots,
keyboard input, browser history or screen contents. - Do not implement
app blocking in this phase.

Acceptance criteria: - Permission denied path works and does not
crash. - Permission granted path returns selected-app summaries on at
least one emulator and one physical Android device. - Permission
revocation is detected when returning to the app. - Only selected
package identifiers and aggregate durations leave the device. - Tests
verify empty data, invalid time ranges, permission errors, package
filtering and date boundaries. - No claims of real-time monitoring;
state clearly whether data is refreshed on demand or periodically.

## Phase 4 --- Local-first dashboard and usage analytics

**Goal:** Show real and honest metrics.

Tasks: 1. Create a typed UsageRepository interface. 2. Read daily and
weekly usage aggregates from native module. 3. Persist only necessary
local aggregates (or fetch on demand) with an explicit retention policy.
4. Dashboard displays: - selected-app usage today; - focus minutes and
completed sessions; - daily cognitive exercise status; - one
deterministic suggestion when evidence exists. 5. Display a first-run
baseline state until sufficient data exists. 6. Distinguish "no
permission," "monitoring paused," "no selected apps," "no data," and
"data unavailable." 7. Show last updated time and data coverage. 8.
Avoid presenting all phone use as waste. Only show user-selected apps in
the "unwanted usage" view. 9. Add date/time formatting using user
timezone.

Acceptance criteria: - Dashboard never uses hardcoded demo metrics. -
Empty, denied and loading states are designed and tested. - Totals
reconcile with native returned data. - User can refresh and pause
monitoring.

## Phase 5 --- Focus sessions

**Goal:** Make focus sessions robust, recoverable and measurable.

Tasks: 1. Implement 15/25/45-minute presets and custom duration (within
sensible limits). 2. Require or encourage a user-written intention, but
allow skip. 3. Implement start, pause, resume, complete, abandon and
reset. 4. Persist session state locally so app process death does not
reset the timer. 5. Use absolute timestamps / monotonic clock strategy
appropriately; do not rely only on `setInterval` tick count. 6. Handle
app backgrounding, device sleep, app restart, clock/time-zone changes
and notification permission state. 7. On completion, ask a short
reflection: progress made, interruption count (self-reported only unless
measured reliably), optional note. 8. Save session to backend when
backend is ready; queue safely while offline. 9. Prevent duplicate
completion writes with idempotency. 10. Notifications are optional and
must respect quiet hours. Do not request notification permission until
needed.

Acceptance criteria: - Timer remains correct after app background and
foreground. - Process restart recovers an active session or presents a
clear recovery choice. - Completed/abandoned sessions persist once. - No
false claims that other apps were blocked or that the user remained
focused.

## Phase 6 --- Cognitive Gym

**Goal:** Deliver useful reasoning practice, not an "IQ score."

Initial exercise types: - identifying assumptions; - distinguishing
correlation from causation; - evaluating evidence quality; - drawing
valid inferences; - spotting logical fallacies; - reading comprehension
and argument evaluation.

Tasks: 1. Move hardcoded exercise from `TrainScreen.tsx` into a typed
content model. 2. Create a local versioned exercise bank with at least
30 reviewed exercises across skills and difficulty levels. 3. Each
exercise includes: id/slug, skill, difficulty, prompt, options or
response format, correct answer, explanation, source/author/reviewer,
content version. 4. Ensure answer choices are unambiguous and
explanations teach the reasoning. 5. Randomize or schedule exercises
without repeating too frequently. 6. Record attempt, answer, duration
(optional), correctness and skill. 7. Provide answer review and
reasoning explanation. 8. Avoid unsupported claims of transfer to
general intelligence or clinical cognitive improvement. 9. Add content
review tests for duplicate IDs, missing explanations, invalid answer
keys and malformed content.

Acceptance criteria: - At least 30 quality-reviewed exercises. -
Exercises are categorized by skill and difficulty. - Attempts are stored
locally first and synced when backend is available. - No IQ, diagnosis
or medical score. - Correctness is graded by trusted content, not
client-provided `isCorrect`.

## Phase 6b --- Reset, mindful pause, evidence-based practice (done)

Built 2026-11-07: 14-day Reset with day-1/day-14 attention check, mindful
pause before chosen apps (Accessibility service, Play-policy disclosure),
"Question it" drill, spaced Recall, if-then plans, move break. See
IMPLEMENTATION_STATUS.md.

## Phase 6c --- Website pause, reels counter, real-device hardening

**Goal:** Meet people where short-video and endless feeds actually live
(browsers, Reels, Shorts), with the same kind, non-blocking pause, and
show the real number of reels scrolled, without becoming a monitoring
app.

Added 2026-11-08 at the user's request (competitor reference: BrainPal
counts Instagram Reels, YouTube Shorts, Facebook Reels and Snapchat via
the Accessibility API and blocks at a reel cap).

Tasks:

1. Real-device hardening of the pause (done 2026-11-08, POCO M4 Pro,
   HyperOS): draw the pause as an accessibility overlay instead of an
   Activity (Xiaomi blocks background activity starts); ignore small
   windows (Xiaomi video toolbox, app pop-ups) when deciding "the user
   left"; ignore leftover events briefly after a dismissal; treat a
   full-screen open as always real.
2. Website pause (opt-in): in known browsers, read only the address-bar
   text, reduce it to a site name, compare with the user's list on the
   phone. Same breath, "Not now" and "Open for N min". Ignore the bar
   while the user is typing. Store only the list and daily counts.
3. Reels counter (opt-in): in YouTube and Instagram, count each new item
   the short-video pager moves to (matched by view id). Store one number
   per app per day. Show today, per app and the last 7 days, with Pip
   reacting kindly (no shame, no "brain damage" visuals).
4. Optional daily reel limit: at the limit, show the pause ("That's N
   reels today") with "Not now" and "Keep watching for N min". Never a
   hard block.
5. Separate prominent disclosure and tick-box consent for each feature
   (Play policy: each kind of on-screen data), consent recorded
   append-only; base pause disclosure explains why Android shows "view
   and control screen". Service requests extra event types only while a
   feature is on.
6. Update docs/PLAY_POLICY_PAUSE.md, docs/PRIVACY_AND_PLATFORM.md,
   Play Console declaration and Data safety answers.

Acceptance criteria: - With both features off, the service behaves
exactly as the app pause (window-state events only). - Website pause
works in at least Chrome-family browsers on a real phone. - Reels are
counted on a real phone for YouTube Shorts and Instagram Reels, and the
view ids are re-verified after app updates. - Nothing about pages,
videos or text typed is stored or sent. - Facebook and Snapchat are
listed as not supported until they can be detected reliably.

Later (not in 6c): Facebook Reels / Snapchat Spotlight if a reliable,
privacy-preserving signal exists; per-app reel limits; reel counts in
the weekly review (Phase 10); a home-screen widget.

## Phase 6d --- "Win back your time" onboarding and the intensity ladder

**Goal:** Buy back time first. Users arrive losing hours to feeds, so the
first win is protection, before focus sessions and practice. Stay
evidence-based and kind: a pause, not a hard block, unless the user
chooses Strict for a while.

Evidence: self-chosen optional limits reduced social media use by about
17% and self-control problems drive about 31% of use (Allcott, Gentzkow
& Song, AER 2022); users drift to weaker settings over time, and over
half end with no interventions (Kovacs et al., CHI 2021); a gentle pause
cut opens by about 37% (Grüning et al., PNAS 2023).

Tasks (built 2026-11-08):

1. Onboarding, right after the screen-time reality check: "First, let's
   win back some of that time" with "Yes" or "Set up later". Then one
   step each for apps, reels and websites, each with its own disclosure
   and tick box (Play policy) and a Skip; a level step (Pip suggests
   Gentle, or Firm for exam prep with 6+ h/day, never Strict); one trip
   to Android Settings, resumed on return ("You're protected").
   Level and Android steps only appear if a feature was switched on.
   Steps only appear where the pause service exists (Android).
2. Intensity ladder applied to apps, websites and Shorts:
   Aware (count only) · Gentle (5 s breath) · Firm (15 s breath, say
   why, 2 min, 5 opens a day per app or site) · Strict (locked until a
   chosen time; emergency unlock after a 60 s wait, counted).
3. Tightening is instant; loosening waits 24 h (shown, cancellable);
   Strict always has an end (max 30 days) and ending it early also waits
   up to 24 h. Turning features or the service off stays immediate.
4. Same picker in Insights.

Later (Phase 8 coach): suggest firmer when "Open anyway" dominates and
time isn't falling; suggest gentler when emergency unlocks pile up,
instead of letting the user drift to nothing; invite a step up before
exams. Suggestions only, never automatic.

## Phase 7 --- Backend and database

**Goal:** Add secure persistence after local mobile flows work.

Tasks: 1. Scaffold NestJS with pinned compatible dependencies and strict
TypeScript. 2. Add environment configuration validation at startup. 3.
Add PostgreSQL local Docker Compose (optional if user has local
PostgreSQL). 4. Select one migration/ORM tool (Prisma recommended) and
make migrations the source of truth. Reconcile existing
`database/schema.sql`. 5. Add seed script for development exercise
content only. 6. Implement auth module and current-user guard. 7.
Implement users/preferences, onboarding/goals, consent, tracked apps,
usage, focus, cognitive, interventions, insights and privacy modules
incrementally. 8. Ensure every query is scoped to authenticated user. 9.
Add validation, rate limits, pagination, payload caps, error shape and
request IDs. 10. Add API version prefix `/v1`, Swagger/OpenAPI and
health endpoint. 11. Fix CORS allowlist by environment. Never use an
empty array as an accidental all-or-nothing production policy. 12. Store
timestamps in UTC and calculate usage day boundaries in the user
timezone. 13. Add idempotency to daily usage batch and session
completion. 14. Add account deletion and export workflows; deletion must
cover related rows and defined downstream copies. 15. Add integration
tests using a disposable test database.

Acceptance criteria: - Migrations create a clean database from
scratch. - Seed creates known development exercises. - Authenticated
user A cannot read or mutate user B's records. - Invalid payloads are
rejected. - Duplicate idempotent requests do not duplicate records. -
Swagger accurately reflects implemented endpoints. - `npm run build`,
tests and lint pass.

### Phase 7 scope as built (2026-11-09)

Agreed with the developer: a lean backend for **Google sign-in plus backup and
restore**, on free tiers (Neon PostgreSQL, Render web service). The app stays
local-first and works with no account.

Built: NestJS 12 + Prisma 7, env validation, Google ID token sign-in, rotating
refresh tokens with reuse detection, settings backup with version conflicts
(409), idempotent batches for consents, focus sessions, gym attempts and gym
workouts, cursor paging, export, account deletion by cascade, `/v1` prefix,
Swagger, health, error shape, request ids, rate limits, payload caps, CORS off
by default, integration tests on a disposable PostgreSQL, `render.yaml`.

Deliberately not built, and why:
- Docker Compose: a real PostgreSQL runs from `embedded-postgres` instead.
- Seed of exercises: exercises ship inside the app; the server stores none.
- Usage, tracked apps, interventions, insights endpoints: usage data stays on
  the phone (privacy by default). Revisit only if a feature needs it.
- Lint for the backend: not set up yet; type-check and tests are the gate.

Still to do for Phase 7: release keystore, Google OAuth clients, Neon and
Render accounts (developer), then the mobile side (Google sign-in through
Android Credential Manager, a sync queue, restore on a new phone).

## Phase 8 --- Rules-based behavioral coach

**Goal:** Deliver explainable interventions without ML.

Initial signals: - user-selected app usage above a user-defined
threshold; - repeated foreground transitions in a time window, only if
event count is reliable; - focus session paused/abandoned by user; -
scheduled user-selected focus window; - user-requested support.

Initial intervention types: - pause and check intention; - start a short
focus session; - take a deliberate break; - reflect on what task is
being avoided; - complete a short cognitive exercise; - dismiss or
snooze.

Tasks: 1. Implement pure, deterministic rules with unit tests. 2. Use
user-configurable thresholds and quiet hours. 3. Add cooldowns to
prevent repeated prompts. 4. Provide "Why am I seeing this?" with the
exact signal and data window. 5. Record shown, accepted, dismissed,
snoozed and completed outcomes. 6. Make all interventions dismissible
and monitoring/interventions independently switchable. 7. Do not infer
boredom, anxiety, depression, ADHD, addiction or motivation from app
usage. 8. Avoid interrupting while the user is in a focus session unless
the user explicitly configured an emergency exception. 9. Limit
notifications; prefer in-app interventions initially.

Acceptance criteria: - Rules are deterministic and documented. - Same
input produces same output. - Cooldown and quiet-hours behavior
tested. - User can disable all interventions. - No ungrounded
psychological statements.

## Phase 9 --- AI coach (after deterministic product works)

**Goal:** Use an LLM for supportive language and reflection, not as an
authority over the user's psychology.

Tasks: 1. Keep rule selection separate from LLM copy generation. 2. Use
a server-side provider abstraction; never put API keys in the mobile
app. 3. Send only minimal, consented, non-sensitive context
(e.g. user-selected goals and aggregate usage category). 4. Do not send
package names or raw detailed event history unless essential and
explicitly disclosed. 5. Add strict output schema, timeout, retry
limits, rate limits and cost controls. 6. Add fallback deterministic
copy if provider unavailable. 7. Add safety policy: no diagnosis,
treatment, shame, manipulation, coercion or unsupported claims. 8. Do
not use the LLM to grade objective exercise answers. 9. Add
prompt-injection defenses; treat user-entered content as untrusted data.
10. Add evaluation dataset for helpfulness, factuality, tone, privacy
leakage and policy compliance. 11. Explain that suggestions are
generated and may be imperfect. 12. Add opt-out and deletion behavior
for any retained provider data according to provider terms.

Acceptance criteria: - AI is optional and fails gracefully. - No API
secret in app bundle or Git. - Output validates against schema. -
Unsafe/off-topic outputs are rejected or replaced. - No sensitive user
profiling.

## Phase 10 --- Insights and weekly review

Tasks: 1. Weekly summary of selected-app usage versus personal baseline.
2. Focus sessions started/completed and total intentional focus time. 3.
Cognitive exercise attempts and performance by skill/difficulty. 4. User
self-report of time reclaimed and usefulness. 5. Explain missing data
and coverage. 6. Do not compare users publicly or create leaderboards.
7. Do not conflate exercise accuracy with general intelligence. 8.
Recommendations must link to actual observed signals.

Acceptance criteria: - Weekly report calculations tested against
fixtures. - No fabricated comparisons when baseline is insufficient. -
All metrics have definitions and date windows.

## Phase 11 --- Privacy, security, accessibility and release hardening

Tasks: 1. Permission rationale and revocation instructions. 2.
Monitoring pause and opt-out. 3. Data export and account deletion. 4.
Retention policy for local and server data. 5. HTTPS/TLS for remote
traffic. 6. Secure token storage and refresh rotation. 7. Password
hashing and brute-force protections if password auth is used. 8.
Redacted logs; no tokens, prompts or sensitive usage payloads in logs.
9. Database backups and deletion propagation policy. 10. Android app
privacy policy and Play Data Safety disclosures based on actual
behavior. 11. Verify Android package visibility requirements. 12. Verify
target SDK and Google Play policy at release time. 13. Accessibility:
contrast, touch target sizes, screen reader labels, font scaling and
reduced motion. 14. Crash/error monitoring with privacy-conscious
configuration. 15. Build debug and release variants; protect signing
keys. 16. Test low-memory devices, process death, offline state,
permission revocation, time-zone change and daylight-saving transitions.

**App blocking is explicitly out of scope for the first alpha.** Android
has no universal unrestricted third-party app-blocking API. Do not use
AccessibilityService as a deceptive workaround. Research platform and
Play policy eligibility separately before proposing blocking.

Acceptance criteria: - Security/privacy checklist signed off. - Data
export and deletion tested. - Permission revocation works. - No secrets
in repository or APK resources. - Release build succeeds. - Play policy
review completed before submission.

## Phase 12 --- Beta instrumentation and learning

**Goal:** Validate behavior change, not vanity engagement.

Pilot with 30--50 opt-in users after privacy and security gates.

Measure: - onboarding completion; - permission opt-in without pressuring
users; - selected-app usage versus personal baseline; - focus sessions
started/completed; - exercise completion and skill-specific
performance; - intervention accept/dismiss/snooze; - user-reported
intentional time reclaimed; - day-7/day-30 retention; - perceived
control and usefulness.

Do not use "time in RECLAIM" as the north-star metric.

Do not train ML from small or biased samples. First evaluate data
quality, sample size, consent, fairness, and outcome labels. Consider
contextual bandits only after there is enough opt-in data and an
experiment framework.

------------------------------------------------------------------------

# 6. Database requirements and corrections

The current `database/schema.sql` is a useful draft. Before production
use:

1.  Confirm and document all ten tables.
2.  Add migrations; do not rely on manually rerunning a raw SQL file in
    production.
3.  Add `updated_at` behavior for mutable tables.
4.  Add explicit indexes for common user/date lookups.
5.  Add check constraints for allowed states and sensible ranges.
6.  Add foreign-key ownership and deletion semantics.
7.  Define whether email is required, verified, and case-normalized.
8.  Add auth tables or use a managed auth provider; do not store
    plaintext passwords.
9.  Add onboarding completion state and consent policy version.
10. Add tracked-app update semantics.
11. Add idempotency key storage or unique request identifiers for batch
    uploads.
12. Add `source_version`/app version to usage ingestion where useful.
13. Keep daily usage aggregates separate from raw events; do not store
    raw event stream by default.
14. Add `intervention_rules` or versioned rule configuration only if
    needed; do not over-model early.
15. Consider storing exercise content in versioned files and seeding it,
    while attempts remain relational.
16. Add export request status/audit records only when the export
    workflow is implemented.
17. Define retention and hard-delete/anonymization policy.
18. Consider PostgreSQL row-level security as defense in depth, while
    retaining application-level ownership checks.

Potential schema refinements: - `app_usage_daily`: unique
`(user_id, tracked_app_id, usage_date)` already exists; add an index
matching user/date queries and ensure `usage_date` is based on the
user's timezone. - `focus_sessions`: define valid status transitions;
ensure `ended_at >= started_at`; constrain actual duration to sensible
values. - `exercise_attempts`: server grades response; do not accept
client-supplied `is_correct`. - `interventions`: add rule version and
stable reason code if useful; store minimal trigger context. -
`consent_records`: append-only history; do not overwrite historical
consent.

------------------------------------------------------------------------

# 7. Testing strategy

## Mobile

-   Unit tests for formatting, timer calculations, aggregation and rule
    engine.
-   Component tests for onboarding, permissions, focus, exercise and
    empty/error states.
-   Native bridge tests for permission states, selected package
    filtering, invalid time range and no data.
-   Android instrumentation/manual tests for Usage Access and permission
    revocation.
-   Device tests across at least one emulator and one physical device.

## Backend

-   Unit tests for services and validation.
-   Integration tests for repositories and migrations.
-   Auth and authorization tests proving cross-user access is
    impossible.
-   API contract tests for payload validation, rate limiting and
    idempotency.
-   Deletion/export tests.

## End-to-end

-   Install app.
-   Complete onboarding without monitoring.
-   Complete a focus session.
-   Complete cognitive exercise.
-   Enable Usage Access.
-   Select apps.
-   View actual usage summary.
-   Pause monitoring and verify no further collection.
-   Revoke permission in Android Settings and verify app handles it.
-   Complete data export/deletion test account flow.

## Required quality commands

Claude Code must add appropriate scripts and document them. At
minimum: - install dependencies from lockfile; - lint; - typecheck; -
unit tests; - backend build; - Android debug build; - test database
migration from empty state.

Do not mark tests passed unless they were actually run and the output
was inspected.

------------------------------------------------------------------------

# 8. Delivery milestones

  --------------------------------------------------------------------------------
  Milestone               Deliverable             Definition of done
  ----------------------- ----------------------- --------------------------------
  M0                      Environment + repo      Versions and gaps documented
                          audit                   

  M1                      Runnable Android shell  Installs and five tabs work

  M2                      Onboarding + consent    User can proceed without
                                                  monitoring

  M3                      Native Usage Access     Selected app aggregates on real
                                                  device

  M4                      Real dashboard          No fake metrics; clear empty
                                                  states

  M5                      Focus sessions          Timer survives
                                                  background/restart and persists

  M6                      Cognitive Gym           Reviewed content and recorded
                                                  attempts

  M7                      Backend + DB            Authenticated APIs and
                                                  migrations

  M8                      Rules-based coach       Explainable, controllable
                                                  interventions

  M9                      Privacy + release       Export/delete/security/release
                          hardening               gates

  M10                     Closed beta             30--50 opt-in users and measured
                                                  learning
  --------------------------------------------------------------------------------

**Do not jump to M8/M9 AI features before M1--M7 work.** The first
valuable alpha can be local-first and does not need a cloud AI model.

------------------------------------------------------------------------

# 9. Claude Code working protocol

Use the following operating procedure.

### At the beginning of each phase

1.  Read this plan and current `IMPLEMENTATION_STATUS.md`.
2.  State the phase goal and files expected to change.
3.  Identify prerequisite blockers.
4.  Make a short implementation plan.
5.  Implement only that phase.

### At the end of each phase

1.  Run tests and builds.
2.  Report exact commands and pass/fail output.
3.  List changed files.
4.  List known limitations and follow-up work.
5.  Update `IMPLEMENTATION_STATUS.md`.
6.  Do not silently proceed to the next phase.

### Engineering quality rules

-   Strict TypeScript; avoid `any`.
-   Kotlin null-safety and explicit error handling.
-   No giant components; feature-oriented modules.
-   No duplicated business logic between client and backend when server
    is authoritative.
-   Validate all external inputs.
-   Use typed API contracts.
-   No secrets in code.
-   No fake data in production UI.
-   No unnecessary microservices or premature ML.
-   Accessibility and privacy are acceptance criteria, not later polish.
-   Keep Android permission explanations user-readable.
-   Every background task must have a documented battery and lifecycle
    strategy.

------------------------------------------------------------------------

# 10. Copy/paste initial prompt for Claude Code

Paste this prompt after placing this file at the repository root as
`IMPLEMENTATION_PLAN.md`:

> Read `IMPLEMENTATION_PLAN.md` and all existing repository docs/source
> files. You are the implementation engineer for RECLAIM. Start with
> Phase 0 only.
>
> First audit the repository and local environment. The developer
> previously reported Node.js v20.11.1, npm 10.2.4, Git 2.44.0, and
> `java` was not recognized in PowerShell. These may have changed;
> verify instead of assuming.
>
> Check the current official React Native Android setup requirements and
> NestJS CLI Node requirements. Recommend one compatible stable version
> matrix and list any missing prerequisites. Do not install software or
> change machine-wide settings without asking.
>
> Inspect the starter code and identify all missing project manifests,
> generated Android project files, native module registration, backend
> configuration, database migration setup and tests. Create/update
> `IMPLEMENTATION_STATUS.md`.
>
> Do not scaffold the app or implement features until you have presented
> the audit, prerequisite status, version matrix, and proposed Phase 1
> actions. After presenting that report, wait for my approval.
>
> Follow the phases and acceptance criteria in `IMPLEMENTATION_PLAN.md`.
> Never claim an implementation or test passed unless you ran it.

------------------------------------------------------------------------

# 11. Official technical references

-   React Native Android/Windows environment:
    https://reactnative.dev/docs/set-up-your-environment
-   React Native release status:
    https://reactnative.dev/releases/overview
-   React Native Community CLI:
    https://github.com/react-native-community/cli
-   Android UsageStatsManager API:
    https://developer.android.com/reference/android/app/usage/UsageStatsManager
-   Android UsageEvents API:
    https://developer.android.com/reference/android/app/usage/UsageEvents
-   Android special app access:
    https://developer.android.com/training/permissions/requesting-special
-   Android package visibility:
    https://developer.android.com/training/package-visibility
-   Android app quality:
    https://developer.android.com/docs/quality-guidelines/core-app-quality
-   Google Play policy center:
    https://support.google.com/googleplay/android-developer/topic/9877466
-   Node.js downloads: https://nodejs.org/en/download/
-   NestJS first steps: https://docs.nestjs.com/first-steps
-   PostgreSQL documentation: https://www.postgresql.org/docs/
-   Prisma documentation: https://www.prisma.io/docs

------------------------------------------------------------------------

## Final product rule

**RECLAIM is not another app designed to maximize time spent inside the
app.**

Its job is to help people reclaim attention for their studies, work,
relationships, health, creativity and meaningful life outside the
screen. Every feature, notification, metric and business decision should
support that outcome.
