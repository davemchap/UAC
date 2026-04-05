ALTER TABLE "personas"
  ADD COLUMN IF NOT EXISTS "travel_mode" text NOT NULL DEFAULT 'human-powered';
