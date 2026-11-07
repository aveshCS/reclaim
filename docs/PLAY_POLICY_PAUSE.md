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
| Minimal access | `typeWindowStateChanged` events only; `canRetrieveWindowContent=false`; no gestures, no key events. Only `event.packageName` is read |
| No autonomous actions | Deterministic rule in `GateDecider.kt`: if a user-chosen app comes to the front, show RECLAIM's own pause screen. Never taps, scrolls or changes anything in other apps |
| Separate prominent disclosure | `PauseDisclosure` (src/features/pause/PauseSetup.tsx): its own full screen shown when the user taps "Set up the pause", before Android Settings opens; covers why, what is accessed, what is never done, what is stored, and how to turn it off |
| Affirmative consent | "I understand and agree…" tick box; "Agree and open settings" stays disabled until ticked. Decline leaves everything off. Consent is recorded append-only (`accessibility_pause`) |
| User control | "Open anyway" always works; "Not now" is one tap; "Turn the pause off" in app; switch off in Android Settings any time |
| Data | Chosen package names, labels and daily counters only, on device. Nothing is sent anywhere |
| Not a blocker | Nothing is blocked. The pause is a 5-second breath with a choice |

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
- Some OEMs (e.g. Samsung, Xiaomi) restrict background services more aggressively; real-device
  testing is required (competitor reviews show this is where such apps fail).
