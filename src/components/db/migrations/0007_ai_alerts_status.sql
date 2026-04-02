ALTER TABLE "ai_alerts" ADD COLUMN "status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "ai_alerts" ADD COLUMN "sent_at" timestamp;
ALTER TABLE "ai_alerts" ADD COLUMN "updated_at" timestamp DEFAULT now();
