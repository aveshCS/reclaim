-- SUPERSEDED (Phase 7): the schema now lives in backend/prisma/schema.prisma and its
-- migrations under backend/prisma/migrations. This early draft is kept for reference only.
-- RECLAIM initial PostgreSQL schema (v0.1)
-- UUID generation: CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light','system')),
  focus_default_minutes SMALLINT NOT NULL DEFAULT 25 CHECK (focus_default_minutes BETWEEN 5 AND 180),
  monitoring_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('study','work','reading','sleep','relationships','creative','other')),
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tracked_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  display_name TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, package_name)
);

CREATE TABLE app_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tracked_app_id UUID NOT NULL REFERENCES tracked_apps(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  foreground_seconds INTEGER NOT NULL DEFAULT 0 CHECK (foreground_seconds >= 0),
  open_count INTEGER CHECK (open_count IS NULL OR open_count >= 0),
  source TEXT NOT NULL DEFAULT 'android_usage_stats',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tracked_app_id, usage_date)
);
CREATE INDEX idx_app_usage_user_date ON app_usage_daily(user_id, usage_date DESC);

CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES user_goals(id) ON DELETE SET NULL,
  intention TEXT NOT NULL,
  planned_seconds INTEGER NOT NULL CHECK (planned_seconds BETWEEN 60 AND 10800),
  actual_seconds INTEGER NOT NULL DEFAULT 0 CHECK (actual_seconds >= 0),
  status TEXT NOT NULL CHECK (status IN ('planned','active','completed','abandoned')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  reflection TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_focus_user_started ON focus_sessions(user_id, started_at DESC);

CREATE TABLE cognitive_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  skill TEXT NOT NULL CHECK (skill IN ('inference','assumptions','evidence','argument_quality','comprehension','logic')),
  difficulty SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  prompt JSONB NOT NULL,
  answer_key JSONB NOT NULL,
  explanation TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exercise_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES cognitive_exercises(id),
  response JSONB NOT NULL,
  is_correct BOOLEAN NOT NULL,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attempts_user_time ON exercise_attempts(user_id, attempted_at DESC);

CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('repeated_open','long_session','focus_break','user_requested','scheduled')),
  trigger_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  message TEXT NOT NULL,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('pause','focus','break','reflection','exercise','none')),
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_action TEXT CHECK (user_action IN ('accepted','dismissed','snoozed','completed','ignored')),
  action_at TIMESTAMPTZ
);
CREATE INDEX idx_interventions_user_shown ON interventions(user_id, shown_at DESC);

CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retain only the minimum data needed. Add row-level security before multi-tenant
-- production deployment; enforce user ownership in every API query as well.
