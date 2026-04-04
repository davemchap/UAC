CREATE TABLE IF NOT EXISTS "personas" (
  "id" serial PRIMARY KEY NOT NULL,
  "persona_key" text UNIQUE NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "color" text NOT NULL,
  "literacy_level" text NOT NULL,
  "unknown_terms" text[] NOT NULL DEFAULT '{}',
  "max_sentence_length" integer NOT NULL,
  "max_grade_level" real NOT NULL,
  "success_criteria" text NOT NULL,
  "behavioral_context" text,
  "updated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);
