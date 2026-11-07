# Initial API contract (v0.1)

All endpoints are versioned under `/v1`. Require authenticated user identity for user-owned resources; never accept a user ID from an untrusted request body as the authorization source.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/me` | Current profile and preferences |
| PATCH | `/me/preferences` | Update timezone, focus defaults and monitoring preference |
| GET | `/goals` | List active goals |
| POST | `/goals` | Create a goal |
| GET | `/usage/daily?from=&to=` | Read daily aggregates for selected apps |
| POST | `/usage/daily/batch` | Upload minimized daily usage aggregates |
| POST | `/focus-sessions` | Start/create a focus session |
| PATCH | `/focus-sessions/:id` | Complete or abandon a session |
| GET | `/exercises/today` | Get today's published exercise |
| POST | `/exercises/:id/attempts` | Submit an answer and receive explanation |
| GET | `/insights/weekly` | Get weekly summaries and recommendations |
| POST | `/interventions/:id/feedback` | Accept, dismiss or snooze a suggestion |
| GET | `/privacy/export` | Request a user data export |
| DELETE | `/me` | Request account and associated data deletion |

## Usage upload payload
```json
{
  "usageDate": "2026-11-07",
  "apps": [
    { "packageName": "com.example.app", "foregroundSeconds": 420, "openCount": 3 }
  ]
}
```

Validate that package names belong to the user's selected tracked apps. Apply rate limits, idempotency and strict payload limits. Do not ingest raw event streams unless a feature demonstrably requires them.
