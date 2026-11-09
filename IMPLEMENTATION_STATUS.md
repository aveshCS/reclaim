# RECLAIM — Implementation Status

Last updated: 2026-11-09

## Phase checklist
- [x] Phase 0 — Audit & environment readiness
- [x] Phase 1 — Runnable Android shell (installed and launched on a physical Android phone, reported by the developer 2026-11-07)
- [x] Phase 2 — Onboarding, preferences, consent (verified on Android 15 emulator; see below)
- [x] Phase 3 — Android Usage Access native integration (verified on emulator; developer confirmed working on their physical phone 2026-11-07)
- [x] Phase 4 — Local-first dashboard (verified on emulator; baseline comparison verified in tests only, see below)
- [x] Phase 5 — Focus sessions (verified on emulator incl. real process kill; backend sync waits for Phase 7)
- [x] Phase 6 — Attention Gym (wider scope; 32 exercises self-checked, independent expert review still required before release)
- [x] Phase 6b — Reset, mindful pause, new practice (pause fixed on a real Xiaomi phone 2026-11-08)
- [ ] Phase 6c — Website pause + reels counter (code and tests done; real-device check pending, see below)
- [ ] Phase 7 — Backend + DB (server built and tested locally; accounts, deploy and the mobile side pending)
- [ ] Phase 8 — Rules-based coach
- [ ] Phase 9 — AI coach
- [ ] Phase 10 — Insights / weekly review
- [ ] Phase 11 — Privacy, security, a11y, release hardening
- [ ] Phase 12 — Beta instrumentation

## Environment (installed 2026-11-07, versions in docs/ARCHITECTURE.md)
Node 26.13.0, npm 11.20.0, JDK Temurin 17.0.21, Android Studio, Android SDK (platform 37.0, build-tools 37.0.0, NDK 27.1.12297006). `JAVA_HOME`/`ANDROID_HOME`/Path set at user level.
Not installed: Docker, system PostgreSQL. Phase 7 uses `embedded-postgres` (PostgreSQL 17 from node_modules) instead.
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

## Phase 5 — Focus sessions + developer feedback (2026-11-07, branch phase-5-focus)
Developer feedback addressed:
1. Onboarding questions vs answers were hard to tell apart, and multi-select wasn't always stated. Now: Pip's lines are blue speech bubbles with a tail and a "PIP" label; answers are white outlined cards with a visible radio circle (single) or square checkbox (multi); every answer group has a "Choose one" / "Choose any that apply" / "Type your answer" tag; multi-select questions also say so in Pip's words.
2. Pip felt distant on the dashboard. Now `PipCompanion` leads Home: speech bubble with context-aware lines (morning, late night, focusing, paused, focused today), tap to get a jump + expression change + friendly line, growth stage and progress bar driven by real saved focus minutes ("25 min to Sprout"), today's focus minutes/sessions, "Grow together · N min" button. Pip encourages but never guilts (no sad Pip about usage).

Phase 5:
- `focusModel.ts` (pure, tested): timestamp-based timing (accumulated + now - resumedAt) so it survives background, sleep and process death; ignores backwards clock jumps; clamps 5-180 min; one active session; finish is idempotent (saved once, keyed by id); sessions under 1 min not saved; completed sessions end at their planned end even if noticed later; first reflection wins; growth stages Seed 0 / Sprout 25 / Seedling 100 / Young plant 250 / Leafy 500 / Blooming 1000 min, never shrinks; defensive parse.
- `FocusContext` persists to on-device storage, finishes due sessions on load and on resume, display tick only while running.
- Focus screen: setup, running, paused, end early with confirm, completion with Pip and optional reflection (progress, self-reported interruptions, note).
- Every saved session has `sync: 'pending'` so Phase 7 can upload each exactly once. No backend yet.
- Not done: notifications (plan says don't ask until needed; deliberate, deferred), quiet hours.

| Check | Result |
|---|---|
| `npm test` | 87/87 (11 suites), run twice |
| typecheck / lint | pass / pass |
| Emulator: onboarding bubbles/hints/checkbox vs radio | verified by screenshots |
| Emulator: Pip tap reaction, growth stage, speech | verified |
| Emulator: real force-stop during a session, 55 s dead, relaunch | timer showed 12:50 at 132 s after start (correct) |
| Emulator: end early -> confirm -> reflection -> Home | saved once; Home showed 2 min, Pip cheering |

Not verified: a full 15-min completion on the device (covered by tests incl. finishing while the app was closed), phone reboot mid-session, time-zone change, haptics. Emulator System UI hung once (Android's process, not RECLAIM); emulator was rebooted.

## Phase 6 — Attention Gym (2026-11-07, branch phase-6-attention-gym)
Scope widened at the developer's request (the differentiator found in competitor research): rebuild attention, not just block apps.
Retention hook, built on healthy mechanics only (no punitive streaks, no infinite feed, no guilt):
- Daily 4-minute workout: 3 drills (always a reasoning puzzle + a rotating pair), varies by day, ends cleanly ("Go enjoy your day").
- Pip's garden: one flower per completed workout, never removed.
- "This week": 7 days, done days bloom, missed days are just empty ("No streaks to lose").
- Progress against yourself: per-drill best, first-5 vs latest-5 after 6 tries, per-skill reasoning accuracy.
- Variety and adaptation: puzzles avoid recent repeats and lean towards the weakest skill; names drill grows 3 -> 6 people.
- Home: Pip invites to today's workout; Think tile shows workout progress / "Workout done ✓".
Drills: Think it through (32 reasoning items across 6 skills, difficulty 1-3, teaching explanations), Deep read (6 original passages, text hidden for 3 questions), Names & faces (adaptive), Remember to remember (prospective memory: sort words, tap Remember on food cues), Steady eye (go/no-go sustained attention).
Grading is done in `gymModel.ts` against trusted content, never trusting the UI. Option order is shuffled per seed so the answer is not always A. Every attempt is stored once with `sync: 'pending'` for the future backend. No IQ, diagnosis or transfer claims.

| Check | Result |
|---|---|
| `npm test` | 142/142 (14 suites) three times in a row; includes per-item content checks (answer keys, distinct options, explanations, no clinical/IQ words) |
| typecheck / lint | pass / pass |
| Emulator | full workout (reasoning -> names & faces -> deep read), celebration + flower, free practice Steady eye at real speed with correct grading |

Known issues / follow-ups:
- Content is self-checked, not independently reviewed (plan requires review before release).
- Names are paired with faces at random (e.g. a female name on a male emoji); fine for memory training but could be paired by presentation later.
- The celebration screen opened scrolled down once (kept the previous scroll position); cosmetic.
- Remember-to-remember not run on the emulator (covered by tests). Haptics unverified.
- One Jest test needed a 30 s timeout under parallel load (not a logic issue).

## Phase 6b — Evidence-based Reset, mindful pause, and new practice (2026-11-07, branch phase-6b-reset-and-pause)
Built from the research review the developer asked for (sources in chat): brain-game far transfer is weak, so the core of "undoing brainrot" is changing daily phone behaviour, plus practice with real-world thinking and retrieval.

1. **The Reset (14 days)** — modelled on the 2025 PNAS Nexus RCT (blocking mobile internet for 2 weeks improved sustained attention). Gentler version: daily limit for chosen apps, daily check-in, a tip per day, if-then plan, optional pause. Day-1 and day-14 attention check (Steady eye, go/no-go) for a personal before/after. Copy says results vary and one person's before/after can't prove cause.
2. **Mindful pause (overlay)** — Android AccessibilityService + RECLAIM's own pause activity. 5-second breath, "Not now" (default, one tap) or "Open X for N min". Built to the Play policy: separate prominent disclosure with tick-box consent before Settings opens, `isAccessibilityTool=false`, window-state events only, `canRetrieveWindowContent=false`, deterministic rule, no actions in other apps, data on device only. See docs/PLAY_POLICY_PAUSE.md (declaration + demo video still to do).
3. **Question it** — 12 real-world claims (forwards, ads, reels, headlines). Socratic: choose the key question first, then judge; teaching takeaway. Based on Abrami 2015 (authentic problems + dialogue worked best).
4. **Recall** — retrieval practice. Passages are re-asked 1 day and 3+ days later; focus-session notes are recalled the next day. Recall takes a workout slot when due.
5. **If-then plans** — editor in Reset start and Profile; shown on the pause screen.
6. **Move break** — 5-minute guided movement before a focus session (acute-exercise evidence: small, short-term attention boost).

| Check | Result |
|---|---|
| Kotlin unit tests | 17/17 (5 pause rule, 12 usage) |
| `npm test` | 164/164 (19 suites), repeated |
| typecheck / lint | pass / pass |
| Emulator: disclosure -> tick -> Android Accessibility settings | verified; Agree disabled until ticked |
| Emulator: open YouTube -> pause screen | verified; "Not now" -> launcher; "Open YouTube for 5 min" -> YouTube; reopen within 5 min -> no pause |
| Emulator: one launch counts one pause | verified after fix (was 2 because YouTube switches screens during launch) |

Bugs found on device and fixed: disclosure did not scroll (Agree button off-screen); double pause on a single app launch; pause stats only loaded once.
Not verified on device: Reset day 1 -> 14 over real days (unit tests cover dates/DST), recall on later real days, move break full 5 minutes, haptics, OEM behaviour (Samsung/Xiaomi). After app reinstall Android disabled the service ("crashed"), requiring re-enable; the app shows "One step left" in that case.
Before Play submission: Accessibility declaration + demo video, privacy policy/Data safety, wording review.

## Phase 6c — Website pause, reels counter, real-device hardening (2026-11-08, branch phase-6b-reset-and-pause, uncommitted)

### Pause fixes from the developer's POCO M4 Pro (Android 13, HyperOS 1.0) — verified on that phone over USB
- Pause never appeared: HyperOS blocked the Activity ("MIUILOG- Permission Denied … Abort background activity starts"). Now drawn as a `TYPE_ACCESSIBILITY_OVERLAY` window (`PauseOverlay.kt`). PauseActivity removed.
- Pause flickered away and came back, even over the home screen: Xiaomi's floating video toolbox (`com.miui.securitycenter`, small window) and YouTube's leftover small events. Now only full-screen windows from other apps dismiss/reset; small events from a chosen app count only if the user is in that app or has been elsewhere ≥1.5 s; 3 s quiet after a dismissal applies to small events only.
- Verified by logs on the phone: open → one pause; home → pause removed, no re-prompt; quick reopen → pause again. Button taps were tested by the developer (Xiaomi blocks adb input).

### Website pause + reels counter — built, unit-tested, NOT yet verified on a device
- Kotlin: `WebMatcher.kt` (address-bar text → site, match list), `ReelTracker.kt` (count forward moves of the short-video pager), service gains runtime event types only while a feature is on; `canRetrieveWindowContent` now true (needed for both).
- JS: `WebAndReels.tsx` (Website pause card, Reels counter card with today / per app / 7-day bars / limit, separate disclosures), settings `web` and `reels`, consents `accessibility_website_pause` and `accessibility_reels_counter`, policy version `2026-11-draft-2`.
- Tests: Kotlin 27/27 (adds 7), Jest 174/174 on three consecutive runs (one earlier run had 1 unidentified failure, likely the known slow-under-load flake). Typecheck and lint clean.
- Unverified: browser address-bar ids other than Chrome's well-known `url_bar`; YouTube Shorts and Instagram Reels pager view ids (from community sources, may be outdated). The debug build logs scroll view ids (`adb logcat -s ReclaimPause`) to calibrate them on a real phone. Facebook and Snapchat not supported.

### Update later on 2026-11-08: reel counting on the POCO, floating Pip
- Found on the phone (saved diagnostics, ids only): YouTube Shorts sends scroll events without item positions (`from=-1`) and usually none at all for a swipe, so index/scroll counting stayed at 0. Counting now uses which `reel_player_page_container` view is in the middle of the screen (a different page view = a new Short), triggered by content-change events in YouTube/Instagram while the counter is on. Scroll-based counting remains as a fallback. Not yet confirmed by the developer that the number matches real swipes.
- Floating Pip (`PipBuddy.kt`): small touch-through overlay over Shorts/Reels with today's count; face changes in 4 stages (by limit, or 10/25/50 without one); bounces on each new reel; hides when leaving Shorts, the app, or when the limit pause shows. Switch in Insights (default on). Not yet seen on the phone (the app pause for YouTube was in front during the check).
- Keyboard and Xiaomi volume panel no longer count as "the user left".
- Tests now: Kotlin 32/32, Jest 174/174 (twice), typecheck and lint clean. FocusFlow test timeout raised to 30 s (it was the earlier intermittent failure).

## Phase 6d — "Win back your time" onboarding + intensity ladder (2026-11-08, uncommitted)
- Website pause fix: Brave was also a chosen app, so the app pause showed first and the site check was skipped; a loaded page sends no more events. The address bar is now checked whenever a pause closes. Chrome confirmed on the POCO; Brave fix not yet confirmed by the developer.
- Onboarding: new steps after the screen-time check (protect → apps → reels → websites → level → Android step), each feature with its own disclosure and tick box, all skippable; shown only where the pause service exists. `onboarding.protect` ('ask' | 'yes' | 'later').
- Intensity ladder (`src/state/intensity.ts`, `Intensity.kt`): Aware / Gentle / Firm / Strict; tighten now, loosen after 24 h, Strict time-boxed (max 30 days). Pause screen variants in `PauseOverlay.kt` (Firm reasons; Locked with 60 s emergency unlock). Picker in onboarding and Insights.
- Verified on the emulator by tapping through: all new onboarding steps, consent ticks gating Continue, Android Settings hand-off and "You're protected", Firm pause (15 s, reason required, "Open YouTube for 2 min"), Gentle request shown as pending with "Keep Firm", Strict until 9 pm locking YouTube, emergency unlock countdown then "Open YouTube for 5 min".
- Not verified: Firm's 5-opens daily budget lock and Strict on Shorts on a real phone; day-boundary behaviour (unit tests only).
- Tests: Kotlin 36/36, Jest 188/188 (twice), typecheck and lint clean.

## UX pass: less text, more life (2026-11-08, uncommitted)
- Picker fix: a gentler level is selected at once and labelled "From <time>"; the level in force shows "Now". Tabs slide (`animation: 'shift'`), buzz on tap, hidden tabs freeze. Release build installed on the POCO to judge speed (debug builds are much slower).
- Browser Shorts/Reels counted from the address (youtube.com/shorts/ID, instagram.com/reel/ID, facebook.com/reel/ID, tiktok.com/@u/video/ID); verified in emulator Chrome (5 counted, Pip "5 / 40" on top). Reel-limit "Not now" now goes Home (Back made YouTube shrink into its mini-player).
- Motion: `Stagger` (every screen's cards arrive one by one), `PressScale` (chips and tiles squish), `Pop` (marks and numbers spring), `Sparkles` (burst on wins), `Tile` (compact expandable card).
- Less text: Insights is now tiles with a one-line summary (reels, intensity, app pause, website pause); consent screens lead with five icon lines, full wording behind "Read the full details"; onboarding science/reality steps cut to a few lines; Home gets a "Today" strip (Not now · reels · focus minutes) instead of sentences.
- Tests: Jest 190/190 (twice), Kotlin 37/37, typecheck and lint clean; testTimeout 30 s set once in jest.config.js.
- Follow-up: Home Focus/Think tiles now fill their row (the shorter one looked lifted off its shadow); app-time cards ("Today in your chosen apps" + "From Pip") get the normal gap. Celebrations: `CelebratePip` (hop + sparkles + success buzz) on Session complete and Workout complete. Pip on Home reacts to the day ("2× Not now today…", gentle concern past the reel limit). Copy trimmed on Focus, Train and Profile. Jest 194/194 (twice).

## App icon (2026-11-08)
- Pip on warm orange (#F26A3D), drawn from Pip's own shapes. Adaptive icon for Android 8+ (`mipmap-anydpi-v26`, foreground vector inside the 66 dp safe zone, orange background colour) plus a monochrome layer for Android 13 themed icons; PNG fallbacks for Android 7 in every density; Play Store 512×512 at `docs/store/icon-512.png`.
- Generated by `mobile/scripts/make_icon.py` (needs Pillow): `python make_icon.py <res dir> <store png> <preview png>`.
- Checked on the emulator's Pixel launcher (all-apps list) and installed on the POCO.

## Keep the pause alive on Xiaomi; first-launch intro (2026-11-09, uncommitted)
- Cause found on the POCO: HyperOS kills RECLAIM when it's cleared from Recents ("SwipeUpClean", "OneKeyClean"); the pause service died with it and Android showed "Not working / malfunctioning". No code crash.
- Fix: the pause service runs in its own process (`android:process=":pause"`, no React Native loaded there). Storage split into CONFIG (written by the app) and STATS (written by the service), both MODE_MULTI_PROCESS; the service re-reads settings at most once a second and every 5 s; old counts migrated once.
- The app now knows "switched on but not running" (`getServiceState`) and shows "Stopped by your phone" with one-tap Autostart / Battery fixes (Xiaomi), plus a new onboarding step "Keep me running" on phones known to close apps (Xiaomi, Samsung, Oppo, Vivo, OnePlus and others).
- First launch now starts with an interactive intro: an endless feed races by; holding "Hold to pause the scroll" (3 s) slows and fades it while Pip grows; letting go speeds it up again; finishing shows Pip and three promises. Skippable. Inspired by Finch (ownership), one sec (experience the pause) and Opal (big-number hook).
- Verified: intro on the emulator (before, mid-hold, after); pause service running in its own process on the POCO after an update. Not yet verified: surviving "clear from Recents" on the POCO (needs a human swipe); the Keep-me-running step on a real Xiaomi onboarding.
- Tests: Jest 196/196, Kotlin unit tests pass, typecheck and lint clean.

## Sound (2026-11-09, uncommitted)
- Kept only Pip's soft pop when tapping Pip (quiet; silent when the phone is on silent/vibrate; "Pip sounds" switch in Profile). The other effects and focus soundscapes were tried and removed at the developer's request ("explore later"); `mobile/scripts/make_sounds.py --all` still generates them.
- Also in this round: onboarding level picker is instant until Continue; reel-limit "Not now" pauses the Short before Home; floating Pip hides only after 1.5 s without a Short. Not yet verified on a phone.
- Tests: Jest 198/198 (twice), Kotlin unit tests pass, typecheck and lint clean.

## Phase 7 — Backend (2026-11-09, uncommitted)
Lean scope agreed with the developer: Google sign-in plus backup and restore, Neon + Render free tiers. Details and what was left out on purpose: IMPLEMENTATION_PLAN.md "Phase 7 scope as built". Routes and rules: docs/API_CONTRACT.md. How to run: backend/README.md.
- Stack: NestJS 12.2, Prisma 7.10 (pg adapter), PostgreSQL 17, jose (JWT), google-auth-library, zod env check, class-validator, throttler, helmet, Swagger. All versions pinned.
- Schema: users, refresh_tokens (hashed), user_settings (versioned JSON), consents, focus_sessions, gym_attempts, gym_workouts; every user table cascades on delete. One migration (`20261109144946_init`), applied to a fresh local database. `database/schema.sql` marked superseded.
- Tests (`npm test`): 29/29 integration tests against a throwaway PostgreSQL with the real migrations; only Google is faked. Covers health, sign-in create/return, forged Google tokens, tampered or foreign-secret access tokens, refresh rotation, reuse revoking all sessions, logout, expired refresh, settings 409 (including four concurrent writers: one wins), 64 KB and 1 MB limits, bad JSON, idempotent batches, paging, validation 400s with nothing stored, user A/B isolation (including a borrowed paging cursor), export, deletion removing every row, auth 429, Swagger listing exactly the 17 routes, security headers, no CORS by default, startup refusing weak config.
- Smoke run: `npm run build` then `node dist/main.js` against the local database: /v1/health ok, /v1/docs 200, sign-in 503 "not configured" (no Google client id yet), /v1/me 401.
- `render.yaml` blueprint added (not deployed). Typecheck clean. No backend lint configured.
- Note: Jest needs `--experimental-vm-modules` because NestJS 12 ships ES modules only; the `npm test` script passes it.
- Not done: release keystore, Google OAuth clients, Neon project, Render deploy (developer accounts needed); mobile sign-in and sync.

## Release signing (2026-11-09)
- Upload key created outside the repo (`~/.reclaim-keys/reclaim-upload.jks`, RSA 4096, valid to 2054); password generated randomly and stored only in that folder and `~/.gradle/gradle.properties`. Release builds use it; without it they fall back to the debug key with a warning. Details and fingerprints: docs/RELEASE_SIGNING.md.
- Verified: `assembleRelease` built, and `apksigner verify` shows the upload certificate (SHA-1 58:C1:2C:…:81:59).
- Developer must back up the key folder off this computer.
- `com.reclaim` has no public Play listing (checked 2026-11-09); that does not prove the id is free. Play Console confirms it when the app is created.

## Google sign-in in the app (2026-11-10, uncommitted)
- Google Cloud project RECLAIM: Web client (server audience) plus Android clients for debug and release keys, created by the developer. The template React Native debug key was already registered for `com.reclaim` by someone else, so RECLAIM now has its own debug key (`~/.reclaim-keys/reclaim-debug.keystore`, see docs/RELEASE_SIGNING.md).
- Native: `GoogleSignInModule` (Android Credential Manager, "Sign in with Google" button flow, returns only the ID token and email) and `SecureStoreModule` (AES-256-GCM, key in Android Keystore) for the refresh token.
- App: `src/cloud/account.ts` (sign-in, single-flight token refresh, sign out with server revoke, delete backup), Profile "Backup (optional)" card, `cloud_backup` consent record on sign-in/out/delete. Release builds show "coming soon" until the server is deployed (`src/config/cloud.ts`).
- Verified on the emulator against the local server: real Google account sign-in succeeded; server created one user and one hashed refresh token; still signed in after force-stop and relaunch; cancelling the sheet returns quietly.
- Not yet verified: sign out and delete on a device (unit/component tests only); release-key sign-in on a phone (needs the deployed server).
- Not built yet: uploading data (sync queue) and restore.
- Tests: Jest 206/206, typecheck and lint clean.
- Emulator note: on this PC the emulator could not resolve names; start it with `-dns-server 8.8.8.8,1.1.1.1`. `hw.keyboard` set to yes in the AVD so the PC keyboard types.
