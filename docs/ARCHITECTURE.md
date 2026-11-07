# RECLAIM — Architecture and toolchain

See `docs/ADR/0001-modular-monolith-and-native-android.md` for the core decisions.

## Toolchain versions (recorded 2026-11-07)

| Tool | Version | Notes |
|---|---|---|
| Node.js | 26.13.0 (LTS) | React Native 0.88.1 requires `^22.13 \|\| ^24.3 \|\| >=26` |
| npm | 11.20.0 | lockfiles committed |
| JDK | Temurin 17.0.21 | `JAVA_HOME` set |
| Android SDK | Platform 37.0, Build-Tools 37.0.0, NDK 27.1.12297006, cmdline-tools 11.0 | `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk` |
| Android Studio | 2026.2.x (winget `Google.AndroidStudio`) | |
| React Native | 0.88.1 (Community CLI 20.2.0) | npm `latest` on 2026-11-07 |
| React / TypeScript | 19.3.0 / 6.0.3 | |
| Gradle | 9.4.1 (wrapper) | from the RN template |
| Kotlin | 2.2.0 | from the RN template |
| Android: min / target / compile SDK | 24 / 36 / 37 | from the RN template; re-check Play target-SDK policy before release |

Mobile libraries: `@react-navigation/native` 7.5.1, `@react-navigation/bottom-tabs` 7.21.0, `react-native-screens` 4.30.1, `react-native-safe-area-context` 5.11.1 (all pinned exactly), `@testing-library/react-native` 14.1.0, `@react-native-async-storage/async-storage` 3.1.1, `react-native-svg` 15.16.1, `react-native-haptic-feedback` 3.0.0. Bundled fonts: Fredoka and Nunito (SIL OFL 1.1).

## Mobile structure (Phase 1)

```text
mobile/
  App.tsx                      NavigationContainer + SafeAreaProvider
  src/navigation/              bottom tabs (Home, Focus, Train, Insights, Profile)
  src/components/              Button, Card, ScreenContainer, SectionHeading, Loading/Error/Empty
  src/features/<feature>/      one folder per feature screen (onboarding, settings, home, focus, train, insights, profile)
  src/state/                   settings reducer + SettingsContext (persisted via src/services/settingsStorage.ts)
  src/services/usageStats.ts   JS wrapper for the (not yet registered) Kotlin module
  src/theme/tokens.ts
```

## Known state

- The Kotlin `UsageStatsModule` is present but not registered with React Native (Phase 3).
- Focus timer is in-memory only (Phase 5). The Train exercise is hardcoded (Phase 6).
- Backend is an outline only (Phase 7).
