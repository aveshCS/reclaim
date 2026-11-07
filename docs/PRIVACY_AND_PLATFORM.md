# Privacy, Android permissions and platform constraints

## Android usage access
Use Android `UsageStatsManager` only after the user explicitly enables Usage Access in system settings. Explain the purpose before sending the user to settings. Re-check permission state when the app resumes because users can revoke it.

Recommended minimal collection:
- package identifier for user-selected apps;
- aggregate foreground duration by day;
- count of foreground transitions/openings where available;
- collection timestamp and app version.

Avoid collecting notification contents, message contents, screen captures, keystrokes, or unrelated app activity. Prefer on-device aggregation and transmit only the minimum aggregate needed for a feature.

## App blocking
Not part of the initial implementation. Android does not provide a universal, unrestricted third-party app-blocking API. Accessibility services have strict Google Play policy requirements and must not be used deceptively or as a workaround. Evaluate supported approaches and policy eligibility before promising blocking.

## Data governance
- Separate account identity from behavioral event data where feasible.
- Encrypt transport and sensitive data at rest.
- Define retention periods and deletion propagation.
- Provide export, deletion, monitoring pause, and permission revocation guidance.
- Do not sell behavioral data or use it for advertising profiles.
- Do not infer mental-health diagnoses, personality, or sensitive traits.

## AI safety
- Coach is supportive, not clinical.
- Label estimates and uncertainty.
- Never claim to diagnose addiction, ADHD, depression, or cognitive impairment.
- Do not use manipulative urgency, shame, or punitive streak loss.
- Give users control over notifications and interventions.

## Implemented behaviour (Phase 3, 2026-11-07)

What the Usage Access integration actually does today:

| Question | Answer |
|---|---|
| When is anything read? | Only after the user opted in (onboarding or Insights), granted Usage Access in Android Settings, chose apps, and is not paused. Reads happen on demand when Insights or the app picker is open, or when the app returns to the foreground on that screen. No background collection, no scheduled jobs. |
| What is read? | Android usage *events* (activity resumed/paused, screen off) for a time range, aggregated on the device into foreground time and "opens" per app (`UsageEventAggregator.kt`). |
| Which apps leave the native layer? | Only the package names the user selected (filtered in Kotlin, and again in JS). The app picker additionally asks for 7-day totals of launcher apps so it can sort the list; those totals stay in memory on the phone and are not stored. RECLAIM itself is always excluded. |
| What is stored? | The list of chosen apps (package name + label) and an append-only record of grant/revoke changes, in on-device storage. Usage numbers are not stored. |
| Is anything sent anywhere? | No. There is no backend yet. |
| Package visibility | A launcher-intent `<queries>` entry, so only apps that appear in the launcher are listable. `QUERY_ALL_PACKAGES` is not used. |
| Permission | `PACKAGE_USAGE_STATS` special access, granted by the user in Settings. Re-checked every time the app returns to the foreground, so revocation is noticed immediately; the UI then explains and stops reading. |
| Definition of an "open" | Coming to the front from a different app, the launcher, or a screen-off. Moving between screens of the same app, or returning within 2 seconds, is not counted. |
| Known limits | Android keeps detailed events for a limited time (often about a week), so 7-day figures can be partial (the UI says so). An app already open at midnight is counted from midnight. Figures are estimates of foreground time; they say nothing about intent or mood. |
