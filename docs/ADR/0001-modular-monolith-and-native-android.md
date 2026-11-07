# ADR 0001: Modular monolith backend and native-first Android client

Status: Accepted (2026-11-07)

## Decision
- Backend: a single NestJS modular monolith on PostgreSQL. No microservices for the MVP.
- Mobile: React Native Community CLI (not Expo Go) with TypeScript; Android-only Usage Access is a Kotlin native module.
- Package manager: npm, lockfiles committed.
- Interventions: deterministic rules first; no ML or LLM until the deterministic product works and consented outcome data exists.

## Why
- Usage Access needs a native module, which Expo Go cannot load.
- One deployable unit is cheaper to build, test and reason about at this stage.
- Explainable rules fit the product principle of agency and transparency.

## Consequences
- Native toolchain (JDK 17, Android SDK) is required for development.
- Module boundaries inside the backend must be kept clean so a split remains possible later.
