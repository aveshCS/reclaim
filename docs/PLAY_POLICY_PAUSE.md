# Google Play policy review: mindful pause (AccessibilityService)

Reviewed 2026-11-07 against the public "Use of the AccessibilityService API" policy
(https://support.google.com/googleplay/android-developer/answer/10964491). This is an
engineering reading, not legal advice. Re-check the live policy and Play Console forms before
each release.

## What the policy says (summary)
- Apps that are not accessibility tools **may** use the AccessibilityService API, but Google
  requires a **prominent in-app disclosure** and **affirmative consent**, plus a **Play Console
  declaration** and a **demo video**.
- Only apps designed to help people with disabilities may set `isAccessibilityTool=true`.
  "Monitoring apps" and "automation tools" are explicitly not accessibility tools.
- Using the API to autonomously plan and execute actions is prohibited. Deterministic,
  rule-based behaviour ("if trigger X, do action Y") is allowed.
- Disclosure must be inside the app, shown during normal use (not hidden in settings), describe
  what is accessed and how it's used, require an affirmative action (tap or tick), and must not be
  bundled with other data disclosures. Undeclared or deceptive use can lead to suspension.

## How RECLAIM complies
| Requirement | RECLAIM implementation |
|---|---|
| Not an accessibility tool | `android:isAccessibilityTool="false"` in `res/xml/pause_gate_service.xml` |
| Minimal access | App pause: `typeWindowStateChanged` only; reads `event.packageName` and whether the window is full-screen. `canRetrieveWindowContent=true` since 2026-11-08 because two **opt-in** features need it: website pause (address-bar text of known browsers only, reduced to a site name, not stored) and reels counter (scroll events whose source view id is the YouTube/Instagram short-video pager; only a count is stored). The service adds `typeWindowContentChanged` / `typeViewScrolled` at runtime only while the matching feature is on. No gestures, no key events |
| Separate disclosure per data type | `FeatureDisclosure` (src/features/pause/WebAndReels.tsx): one full screen for the website pause and one for the reels counter, each with its own tick box and consent record (`accessibility_website_pause`, `accessibility_reels_counter`). The base pause disclosure explains why Android shows "view and control screen" |
| No autonomous actions | Deterministic rule in `GateDecider.kt`: if a user-chosen app comes to the front, show RECLAIM's own pause screen (an accessibility overlay window, `PauseOverlay.kt`). Never taps, scrolls or changes anything in other apps. The only system action is "Home" (`GLOBAL_ACTION_HOME`), and only when the user taps "Not now" or Back |
| Separate prominent disclosure | `PauseDisclosure` (src/features/pause/PauseSetup.tsx): its own full screen shown when the user taps "Set up the pause", before Android Settings opens; covers why, what is accessed, what is never done, what is stored, and how to turn it off |
| Affirmative consent | "I understand and agree…" tick box; "Agree and open settings" stays disabled until ticked. Decline leaves everything off. Consent is recorded append-only (`accessibility_pause`) |
| User control | "Open anyway" always works; "Not now" is one tap; "Turn the pause off" in app; switch off in Android Settings any time |
| Data | Chosen package names, labels, chosen sites, daily counters and daily reel counts per app, only on device. Visited addresses and video details are never stored. Nothing is sent anywhere |
| User-chosen intensity | Gentle (default): 5-second breath with a choice. Firm: 15-second breath, a reason, 2 minutes, a daily open budget. Strict (only if the user picks it, always time-limited): the chosen apps/sites/Shorts show RECLAIM's own "paused for now" screen with "Go back" (Home, or Back inside the app for Shorts) and an always-available emergency unlock after a 60-second wait. All deterministic rules the user configured; RECLAIM never acts inside other apps |

## Still to do before submitting to Play
1. Complete the **Accessibility API declaration** in Play Console (purpose: App functionality;
   personal data collected via accessibility: none beyond the app-in-front check, stored only on
   device. Confirm exact answers against the live form).
2. Record the **demo video**: open app → Insights → "Set up the pause" → full disclosure (scroll
   slowly) → tick → Agree → Android Settings → enable → choose an app → open it → pause appears;
   plus the decline path showing the disclosure again next time.
3. Mirror the disclosure in the **privacy policy** and **Data safety** form (not a substitute for
   the in-app disclosure).
4. Re-review if the pause ever does more than show RECLAIM's own screen.
5. Legal / privacy review of the wording (currently a draft, version `2026-11-draft-1`).

## Known platform behaviour
- After an app update or reinstall, Android may mark the service as crashed and turn it off; the
  user must re-enable it in Settings. RECLAIM shows "One step left" when it detects the service is
  off. Seen on the emulator during development.
- Xiaomi/POCO/Redmi (HyperOS/MIUI) block apps from opening screens in the background unless the
  user grants a hidden "Display pop-up windows while running in the background" permission. The
  first version used an Activity and was silently blocked on a POCO M4 Pro (logcat:
  `MIUILOG- Permission Denied Activity … Abort background activity starts`). The pause is now a
  `TYPE_ACCESSIBILITY_OVERLAY` window drawn by the service, which needs no extra permission;
  verified showing on that POCO M4 Pro (Android 13, HyperOS 1.0) on 2026-11-08.
- On that POCO, Xiaomi's floating video toolbox (`com.miui.securitycenter`, a small `ImageView`
  window) appears when YouTube opens, and YouTube sends small pop-up events while opening and
  closing. These made the pause vanish and re-appear (even over the home screen). Now only
  full-screen windows from other apps can take the pause down or reset it, and a chosen app is
  ignored for 3 s after the pause is dismissed. Verified on the POCO and the emulator.
- Other OEMs (e.g. Samsung, Oppo, Vivo) may also restrict background services; test there too.
