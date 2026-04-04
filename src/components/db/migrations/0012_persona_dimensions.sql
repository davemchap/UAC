ALTER TABLE "personas"
  ADD COLUMN IF NOT EXISTS "years_of_mountain_experience" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "avalanche_training_level" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "backcountry_days_per_season" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weather_pattern_recognition" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "terrain_assessment_skill" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "group_decision_tendency" integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "risk_tolerance" integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "local_terrain_familiarity" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "is_built_in" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "avatar_seed" text,
  ADD COLUMN IF NOT EXISTS "avatar_style" text NOT NULL DEFAULT 'avataaars';
