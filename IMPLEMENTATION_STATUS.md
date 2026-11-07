# RECLAIM — Implementation Status

Last updated: 2026-11-07

## Phase checklist
- [x] Phase 0 — Audit & environment readiness
- [x] Phase 1 — Runnable Android shell (installed and launched on a physical Android phone, reported by the developer 2026-11-07)
- [x] Phase 2 — Onboarding, preferences, consent (verified on Android 15 emulator; see below)
- [x] Phase 3 — Android Usage Access native integration (verified on emulator; developer confirmed working on their physical phone 2026-11-07)
- [x] Phase 4 — Local-first dashboard (verified on emulator; baseline comparison verified in tests only, see below)
- [ ] Phase 5 — Focus sessions
- [ ] Phase 6 — Cognitive Gym (30+ reviewed exercises)
- [ ] Phase 7 — Backend + DB
- [ ] Phase 8 — Rules-based coach
- [ ] Phase 9 — AI coach
- [ ] Phase 10 — Insights / weekly review
- [ ] Phase 11 — Privacy, security, a11y, release hardening
- [ ] Phase 12 — Beta instrumentation

## Environment (installed 2026-11-07, versions in docs/ARCHITECTURE.md)
Node 26.13.0, npm 11.20.0, JDK Temurin 17.0.21, Android Studio, Android SDK (platform 37.0, build-tools 37.0.0, NDK 27.1.12297006). `JAVA_HOME`/`ANDROID_HOME`/Path set at user level.
Not installed: Docker, PostgreSQL (needed Phase 7).
Emulator: AVD `reclaim_pixel` (Pixel 7, Android 15 / API 35 Google APIs x86_64) created and used for verification. A pre-existing AVD `Nexus_6_API_28` was also present.

## Phase 0 — done
- Folder flattened (an empty `reclaim-starter/reclaim-starter/` directory may remain, locked by the editor; delete it manually. It is git-ignored.)
- `git init` (branch `main`, no commits yet), `.gitignore`, `.editorconfig`, `IMPLEMENTATION_PLAN.md`, ADR 0001, `docs/ARCHITECTURE.md`, corrected README.
- Not done: `docs/DATA_DICTIONARY.md` (belongs with Phase 7 schema work).

## Phase 1 — results (commands actually run)
| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 errors, 0 warnings) |
| `npm test` | pass, 3/3 (renders 5 tabs, navigates all tabs, no placeholder metrics) |
| `gradlew assembleDebug` | BUILD SUCCESSFUL (16m44s first build); `app-debug.apk` ~152 MB at `mobile/android/app/build/outputs/apk/debug/` |
| `npm run android` (install on phone) | Developer reports the app installs and runs on their physical phone (not independently verified by me; per-tab on-device check not confirmed) |
| `npm install` from clean lockfile (`npm ci`) | not separately run |

Acceptance criteria not yet met: install/run on a device or emulator; manual check of all five tabs on-device.

### Changes
- RN 0.88.1 Community CLI project merged into `mobile/` (iOS folder and Gemfile removed; Android-only). App ID/namespace `com.reclaim`, display name RECLAIM.
- React Navigation bottom tabs (5 tabs), safe-area handling, 48dp touch targets, 11sp tab labels, accessibility labels.
- Shared components: Button, Card, ScreenContainer, SectionHeading, Loading/Error/Empty states.
- Screens moved to `src/features/*`. Removed hardcoded "0 min / 0 sessions / 0 mindful breaks" metrics and the "25 minutes" claim from Home; Insights/Profile now state plainly that features are not built yet.
- Dark Android theme (window, status and navigation bar colours).
- Scripts: `start`, `android`, `lint`, `typecheck`, `test`, `format`, `build:android-debug`.

### Known limitations / follow-ups
- App icon and splash are the RN template defaults (placeholders).
- `UsageStatsModule.kt` compiles but is not registered (Phase 3). `usageStats.ts` still lacks package filtering and AppState re-check.
- Focus timer in-memory only (Phase 5); Train exercise hardcoded with client-side grading (Phase 6).
- Tab icons are text glyphs, not an icon library.
- `npm audit` reports 17 low/moderate advisories in dev dependencies; not triaged.
- Other starter gaps (schema, API contract, backend, CORS) from the Phase 0 audit remain open for their phases.

## Phase 2 — Onboarding, preferences, consent (2026-11-07)
Implemented: `src/state/settings.ts` (pure reducer), `src/services/settingsStorage.ts` (AsyncStorage + defensive parse), `src/state/SettingsContext.tsx`, `src/features/onboarding/OnboardingFlow.tsx` (welcome, priorities, duration, usage explanation, monitoring choice, review), `src/features/settings/FocusDurationPicker.tsx`, editable Profile (priorities, default focus length, monitoring choice, pause switch, last-consent time), Focus screen uses the saved default length.

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 warnings) |
| `npm test` | pass, 17/17 (reducer, consent append-only, sanitising bad stored data, full onboarding with/without monitoring, resume mid-onboarding, pause persisted, focus default) |
| Gradle debug build with AsyncStorage | BUILD SUCCESSFUL (8m30s), installed on emulator |
| Emulator walk-through (screenshots) | welcome, priorities (Study+Reading), duration (custom 40), usage explanation, monitoring choice, review, Home, Focus (40:00, 40 min chip), Profile all rendered correctly |
| Force-stop mid-onboarding and relaunch | resumed at the duration step with 40 min and priorities kept |
| Force-stop after finishing and relaunch | opened directly on Home |

Not verified on device: the "Yes, set up" path, the Pause switch and the Set up/Off chips in Profile (covered by Jest only); TalkBack; font scaling.

Design decisions / limitations:
- Choosing "yes" only records a preference and a consent record (`usage_monitoring_setup`). Android Settings is NOT opened, no permission is requested, no app list is shown and no usage is read; that arrives with Phase 3. The UI says so. Plan items "select tracked apps" and "Settings opens after explanation" are therefore deferred to Phase 3, together with a second consent at the moment access is actually granted.
- Consent policy version `2026-11-draft-1` and all privacy copy are DRAFT and need review before release.
- Settings are local only (AsyncStorage, not encrypted). Not yet synced to a backend (Phase 7). Data export/deletion not built (Phase 11).
- Monitoring "paused" state exists and is respected by `isMonitoringActive()`.
- Full-width choice chips on the monitoring step are a cosmetic follow-up.
- `react-native run-android` could not find `gradlew.bat` when launched from my tool shell; build with `cd mobile/android; .\gradlew.bat assembleDebug` + `adb install` worked. It worked from your terminal.

## UI redesign: "Calm glow" (2026-11-07, between Phase 2 and Phase 3)
Direction chosen by the developer: Calm glow, dark only (inspired by the polish of apps like Opal and one sec; no gamified guilt).
Implemented: deep-blue aurora background (`GlowBackground`), signature glowing `Orb` (breathes; brightness is driven by `level`, currently always 0 because no focus sessions are saved yet), gradient buttons with press animation and haptics, glass cards, animated chips, `FadeIn` staggered entrances, SVG tab icons, `ProgressRing` focus timer with a completion state, onboarding with step dots and the orb, and a `BreathingPause` full-screen overlay (Home > "Take a pause"). Display font Fraunces (SIL OFL, bundled in `android/app/src/main/assets/fonts`, licence file alongside).
Respects Android "remove animations" via `useReducedMotion`. New libraries: react-native-svg 15.16.1, react-native-linear-gradient 2.8.3, react-native-haptic-feedback 3.0.0.

| Check | Result |
|---|---|
| `npm run typecheck` / `npm run lint` | pass / pass (0 warnings) |
| `npm test` | pass, 17/17 |
| Gradle debug build with new native libs | BUILD SUCCESSFUL (4m05s), installed on emulator |
| Emulator screenshots | welcome, step dots, Home, Focus ring, breathing pause (inhale/exhale text cycles), Train, Profile all render correctly; onboarding completes to Home |

Bugs found and fixed during emulator verification: SVG background did not fill the screen inside the breathing-pause Modal (now sized from window dimensions); onboarding showed 5 dots for 4 steps.
Not verified: haptics (no vibration on emulator), TalkBack, font scaling, "remove animations" setting, light-theme (dark only by design), low-end device performance of the looping animations.
Caveats: the orb is deliberately dim ("resting") until Phase 5 saves real sessions. It must never show a score or streak. Tab/glyph "◌" and "✳" on Home tiles are text glyphs, not drawn icons.

## Redesign 2: "Warm paper" + Pip guided onboarding (2026-11-07) — supersedes "Calm glow"
Developer feedback: the dark glow UI looked AI-generated; wanted an Opal/Regain-style interactive onboarding with a guide, a screen-time reality check and a doomscrolling-and-cognition message. Research summary and sources were given in chat (Opal/Finch/Regain teardowns; 2025 Psychological Bulletin meta-analysis of 71 studies; prospective-memory experiments; Google-effect meta-analysis).
Decisions (developer): warm light identity, guide character "Pip" (sprout creature).

Built:
- Identity: cream paper, ink outlines, hard "sticker" shadows, sunset-orange accent, leaf green; fonts Fredoka (headings) + Nunito (text), SIL OFL, bundled. Removed: aurora background, orb, Fraunces, react-native-linear-gradient.
- `Pip` (SVG): moods happy/think/wow/calm/cheer/concerned, blinking, bobbing, talking mouth, sprout that grows with `growth` (never wilts). Memoised.
- `GuideChat` (typing chat bubbles), `HoldToCommit` (press-and-hold, accessibility action fallback), `CountUp`, `ProgressBar`, `Txt` typography.
- Onboarding (13 steps, skippable, resumable): name, role, exam (students only: JEE/NEET/UPSC/CAT/GATE/CA/boards/college), struggles, science card (hedged claims, "not a medical treatment"), age band, daily screen time, reality check (`lifeMath.ts`, straight-line, labelled as estimate), priorities, focus length (exam-aware suggestion), monitoring choice, pledge, plan summary.
- Profile model extended (name, role, exam, ageBand, struggles, dailyScreenHours, pledgedAt) with defensive sanitising; older saved data migrates.
- Home (greeting by name, Pip hero, Breathe/Think tiles, "why you're here" from priorities), Focus ring, Train with Pip feedback, Profile "About you", Breathe-with-Pip modal.

| Check | Result |
|---|---|
| typecheck / lint | pass / pass |
| `npm test` | 25/25 (3 suites; full skip path, student path incl. reality maths 7h->17y-style check, worker path skips exam, resume+Back) — run twice, stable |
| Gradle debug build | BUILD SUCCESSFUL, installed on emulator |
| Emulator walkthrough | every onboarding step, real press-and-hold pledge, Home, Focus, Breathe modal verified by screenshot. 7 h/day + 18–24 showed "17 years" (7*59/24=17.2) |

Bugs found on emulator and fixed: name field dropped keystrokes (now local draft, saved on Continue/blur); typing animation very slow because Pip re-rendered every tick (memoised); stray dot on empty focus ring; content scrolling under the status bar.
Not verified: haptics, TalkBack, large fonts, real phone performance. One tap on "Let's begin" didn't register on the slow emulator (second tap worked); watch for it on device.
Honesty guardrails kept: no ADHD/treatment claims, research framed as association, the lifetime number is labelled as maths on the user's own estimate, no study-groups promise (no backend), no streaks, pledge is skippable.

## Phase 3 — Android Usage Access (2026-11-07)
Native (Kotlin): `UsageEventAggregator.kt` (pure, JVM-testable: foreground time + opens from usage events; multi-activity apps, 2 s continuation gap, screen-off, range clipping), `UsageStatsModule.kt` (hasUsageAccess via AppOps incl. MODE_DEFAULT fallback; openUsageAccessSettings deep-links to RECLAIM's own page with list fallback; getLaunchableApps via launcher `<queries>`, no QUERY_ALL_PACKAGES; getUsageSummary(start, end, packages) validates range ≤31 days, ≤200 packages, filters to requested packages, excludes RECLAIM, returns earliest event for partial-history detection), `ReclaimPackage.kt` registered in `MainApplication`. Manifest: PACKAGE_USAGE_STATS + launcher queries.
JS: `src/native/usageStats.ts` (typed wrapper, error codes, re-filters packages), `useUsageAccess` (re-check on every resume; append-only grant/revoke consent records), `useAppUsage` (today + last 7 local days, on demand only), `AppPicker` (sorted by recent use, nothing pre-selected, max 30), `AppTimeSection` in Insights (off / paused / unavailable / needs permission / needs apps / loading / error / data), Home "finish setup" prompt. Settings: `trackedApps`, `observeUsageAccess`.

| Check | Result |
|---|---|
| Kotlin unit tests (`gradlew :app:testDebugUnitTest`) | 12/12 pass |
| `npm test` | 45/45 (6 suites), run twice |
| typecheck / lint | pass / pass (android/ now excluded from JS lint) |
| Debug build + install | pass |
| Emulator: not granted -> explanation -> "Open Android settings" | opened RECLAIM's own Usage access page directly |
| Emulator: grant, return | detected on resume, "Now choose your apps" |
| Emulator: picker | real launcher apps, sorted by use, none pre-selected |
| Emulator: numbers vs Android's raw `dumpsys usagestats` events | match: Chrome 2 opens (26 s + 30 s, internal activity switch not double counted), YouTube 1 open (7 s), total ~63 s shown as "1 min" |
| Emulator: revoke from outside the app, return | detected, reading stops, explanation shown, app list kept |

Not yet verified: physical phone (OEM differences, e.g. Samsung), app already in foreground at midnight on a real day, DST, very heavy event volumes, TalkBack. Paused state and error state covered by Jest only.
Known limits (also in docs/PRIVACY_AND_PLATFORM.md): Android event history is limited (UI flags partial weeks); data is read on demand, never in the background; figures are estimates.

## Phase 4 — Local-first dashboard (2026-11-07, branch phase-4-dashboard)
- `UsageRepository` (`src/features/usage/usageRepository.ts`): keeps per-app DAILY totals for chosen apps on the phone (60-day retention, auto-pruned), because Android keeps only ~a week of events. Fills the last 7 completed days and anything missing a newly chosen app; marks days 'full' or 'partial' from where Android's history starts; today is always read fresh and never stored. Deleted when app time is turned off or via Profile > "Delete app-time history" (inline confirm).
- `dashboardLogic.ts` (pure, tested): baseline = average of up to the last 7 complete days, only after 3 complete days; 7-day bars where missing days are null ("no data"), never zero; one deterministic suggestion (passed usual by >=15 min; >=20 opens of one app; evening and >=20% under usual), each with an exact "Why am I seeing this?" reason. No inference about mood or motivation.
- Home is now the dashboard: today's total, "Updated" time, baseline or "building your baseline", partial-day note, week chart with usual-day line, top apps with opens, Pip suggestion, Refresh, Pause; separate designed states for off, paused, needs permission, needs apps, loading, error. Practice tile shows "Done today" (new `practice.lastCompletedDate`, set by Train). Focus minutes are not shown because sessions are not saved yet (Phase 5); Home says so.

| Check | Result |
|---|---|
| `npm test` | 68/68 (9 suites), run twice |
| typecheck / lint | pass / pass |
| Emulator | real totals, "building your baseline 0 of 3", partial-today note, 6 "no data" days, per-app opens, Pause -> "Nothing is being read", Resume |

Not verified on a device: baseline comparison and suggestions (emulator has <1 day of history; covered by unit and UI tests with simulated history), multi-day retention over real days, midnight/DST rollover.
Two layout bugs found on the emulator and fixed (header overlap, wrapped button text not centred).
