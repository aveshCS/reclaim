# RECLAIM

**Take back your attention. Rebuild your mind.**

Android-first app that helps people use their attention intentionally: optional visibility into the apps they choose, focus sessions, and short critical-thinking practice. See `IMPLEMENTATION_PLAN.md` for the plan and `IMPLEMENTATION_STATUS.md` for progress.

This is a work in progress. Only Phase 0 and Phase 1 (runnable app shell) are done; there is no usage monitoring, no saved data and no backend wired up yet.

## Layout

```text
docs/        product spec, UX, API contract, privacy, ADRs
database/    draft PostgreSQL schema (to be replaced by migrations in Phase 7)
mobile/      React Native (Community CLI) + TypeScript app, Kotlin native code
backend/     NestJS outline (not yet runnable)
```

## Prerequisites (Windows)

| Tool | Version used |
|---|---|
| Node.js | 26.x LTS (React Native 0.88 needs ^22.13 / ^24.3 / >=26) |
| JDK | Temurin 17 |
| Android Studio + SDK | Platform 37, Build-Tools 37.0.0 |
| Env vars | `JAVA_HOME`, `ANDROID_HOME` (see `docs/ARCHITECTURE.md`) |

## Run the mobile app

```powershell
cd mobile
npm ci
npm run start          # Metro bundler
npm run android        # in a second terminal; needs an emulator or a USB-debugging phone
```

## Quality commands (mobile)

```powershell
npm run typecheck
npm run lint
npm test
npm run build:android-debug   # Gradle debug APK
```

## Limitations

- Usage Access (app usage statistics) is not implemented yet; the Kotlin module in `mobile/android` is an unregistered example.
- App usage statistics do not reveal intent or mental state. No diagnosis or clinical claims.
- App blocking is out of scope for the first alpha and needs a separate platform and Google Play policy review.
