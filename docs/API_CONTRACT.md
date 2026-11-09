# API contract (v0.2, implemented in Phase 7)

The source of truth is the running server's OpenAPI document at `/v1/docs` (`/v1/docs-json`), which is generated from the code and checked by a test that compares it with the route list below. This page explains the rules behind it.

## Principles
- **Local-first.** The app works fully without an account. The server only holds what the user chooses to back up, so they can restore it on a new phone.
- **Identity comes from the token, never the body.** Every `/me/*` route reads the user id from the access token. Requests cannot name another user.
- **No usage telemetry.** App-usage minutes, package names, reels counts and website lists stay on the phone. There is no endpoint for them.
- All timestamps are UTC. Days that depend on the user's timezone (`date` on gym records) are sent by the app as its local `YYYY-MM-DD`.

## Routes (all under `/v1`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Server and database reachable |
| POST | `/auth/google` | none | Exchange a Google ID token (One Tap / Credential Manager) for our tokens. Creates the account on first use. |
| POST | `/auth/refresh` | none | Rotate a refresh token for a new pair |
| POST | `/auth/logout` | none | Revoke a refresh token (204) |
| GET | `/me` | bearer | Profile: id, email, createdAt |
| DELETE | `/me` | bearer | Delete the account and every row stored for it (204) |
| GET | `/me/export` | bearer | Everything stored for the user, as one JSON document |
| GET / PUT | `/me/settings` | bearer | Settings backup with versioning |
| GET / POST | `/me/consents` | bearer | Consent records, append-only |
| GET / POST | `/me/focus-sessions` | bearer | Focus sessions, upsert by the app's id, paged |
| GET / POST | `/me/gym/attempts` | bearer | Attention Gym attempts, insert-once, paged |
| GET / POST | `/me/gym/workouts` | bearer | Daily workout plans, upsert by day |

## Tokens
- Access token: JWT (HS256), 1 hour, sent as `Authorization: Bearer …`.
- Refresh token: random 32 bytes, stored only as a SHA-256 hash, valid 60 days, **single use**. Each refresh returns a new pair. If a spent refresh token is presented again, every session for that user is revoked (the token was likely copied).

## Sync rules
- **Batches** (`POST` with `{ "items": [...] }`, max 500) are idempotent. Every item carries the app's own `clientId`; re-sending a batch after a timeout never creates duplicates. The response is `{ "stored": n }`.
- A batch is validated as a whole: one bad item rejects the whole request (400) and nothing is stored.
- **Settings** use optimistic concurrency. The first `PUT` creates version 1. Later writes must send `baseVersion`; if another device wrote first the server answers **409** with the current `{version, data, updatedAt}` in `error.details`, so the app can merge and retry. Max 64 KB.
- Paged lists return `{ items, nextCursor }`; pass `?cursor=<nextCursor>&limit=<1..500>`.

## Errors
Every error has one shape:
```json
{ "error": { "status": 409, "code": "conflict", "message": "…", "requestId": "…", "details": {} } }
```
Codes: `bad_request` 400, `unauthorized` 401, `not_found` 404, `conflict` 409, `payload_too_large` 413 (body over 1 MB), `too_many_requests` 429, `unavailable` 503. Every response carries `x-request-id`.

## Limits
- 120 requests per minute per address overall; 10 per minute on `/auth/*`.
- CORS is off unless `ALLOWED_ORIGINS` is set (the mobile app does not need it).
