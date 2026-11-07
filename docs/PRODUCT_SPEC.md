# RECLAIM — Product Requirements Document

**Version:** 0.1 | **Platform:** Android first | **Audience:** Students and working professionals

## 1. Vision
Help people use their attention intentionally by making distracting patterns visible, introducing timely friction, supporting focused work, and offering structured critical-thinking practice.

## 2. Problem statement
Users often open social and entertainment apps automatically, lose time in extended sessions, and struggle to return to meaningful tasks. Existing tools often emphasize blocking or time totals. RECLAIM combines awareness, user-controlled interventions, focus routines, and cognitive practice.

## 3. Target users
- Students (18–25): want to study consistently and reduce short-form-video/social-media distraction.
- Early- and mid-career professionals (22–35): want fewer context switches and more intentional breaks.

Do not assume these groups have a disorder or addiction. Use neutral language such as “unwanted usage” and “distraction pattern.”

## 4. Product principles
1. Agency over shame: never guilt, punish, or insult users.
2. Explainability: show why an intervention appeared and which signal triggered it.
3. Privacy by default: collect the minimum data required; process app-usage aggregates on-device where practical.
4. User control: pause monitoring, choose apps, configure quiet hours, export and delete data.
5. Evidence-aware claims: cognitive exercises are practice, not a clinical assessment or guaranteed restoration of critical thinking.
6. Sustainable use: success means users need RECLAIM less, not spend more time in it.

## 5. MVP scope
### P0 — first beta
- Onboarding: choose personal goals, select distracting apps, set preferred focus duration.
- Baseline: collect a short period of app-usage summaries after explicit permission.
- Dashboard: focus minutes, selected-app usage, sessions completed, one daily suggestion.
- Focus timer: 15/25/45-minute presets, pause/end, session reflection.
- Cognitive gym: one short reasoning/comprehension exercise daily, with explanation and answer review.
- Coach: deterministic, explainable suggestions based on explicit rules; AI-generated wording can be added behind safety and quality checks.

### P1 — after beta feedback
- Habit plans and reminders.
- Weekly report and trend comparisons.
- User-configured schedules and app restriction experiments, subject to Android and Play policy review.
- More exercise categories and difficulty adaptation.

### P2 — after sufficient consented data
- Personalized intervention ranking using contextual bandits or comparable methods.
- Cohort-level insights with privacy safeguards.
- Cross-device support.

## 6. Core user stories
- As a new user, I can choose what matters to me so the app does not impose generic productivity goals.
- As a user, I can understand and grant Usage Access only after seeing a plain-language explanation.
- As a user, I can see how much time I spent in apps I selected, without RECLAIM reading their content.
- As a user, I can start a focus session and record whether I completed my intended task.
- As a user, I can complete a reasoning exercise and understand why an answer is strong or weak.
- As a user, I can dismiss, snooze, or disable interventions.
- As a user, I can pause monitoring and request deletion of my account data.

## 7. MVP success metrics
North-star metric: **intentional time reclaimed per active user per week**, estimated from user-selected app usage reduction and self-reported replacement activity. Do not equate all screen time with waste.

Supporting metrics:
- onboarding completion;
- permission opt-in rate (not an objective to pressure users);
- focus sessions started/completed;
- selected-app usage trend versus a user-specific baseline;
- daily exercise completion and exercise performance trend;
- day-7/day-30 retention;
- intervention dismissal and snooze rates;
- user-reported usefulness and perceived control.

Initial hypotheses, to validate rather than promise: 30% day-7 retention, 15% day-30 retention, and a measurable reduction in user-identified unwanted usage among engaged beta users.

## 8. Non-goals for MVP
- Medical diagnosis, treatment, or claims about neuroplasticity.
- Reading notifications, messages, browsing history, or screen contents.
- Secret or coercive app blocking.
- Training an ML model before there is adequate, consented outcome data.
- Public leaderboards or shame-based streak mechanics.

## 9. Release gates
- Clear permission rationale and revocation instructions.
- Data minimization and account deletion flow.
- Android background/foreground behavior tested across OEM devices.
- Accessibility review for color contrast, touch targets, and screen readers.
- Play policy and Data safety declarations reviewed before public release.
- Beta feedback and crash monitoring in place.
