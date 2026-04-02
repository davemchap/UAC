ALTER TABLE "ai_alerts" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "ai_alerts" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
ALTER TABLE "ai_alerts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
