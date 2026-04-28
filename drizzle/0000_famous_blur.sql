CREATE TYPE "public"."post_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'published');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('unused', 'drafting', 'used', 'archived');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"impressions" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"source" varchar(32) DEFAULT 'manual',
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(256) NOT NULL,
	"token" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "author_content_angles" (
	"author_id" integer NOT NULL,
	"content_angle_id" integer NOT NULL,
	CONSTRAINT "author_content_angles_author_id_content_angle_id_pk" PRIMARY KEY("author_id","content_angle_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"role" varchar(128),
	"bio" text,
	"linkedin_url" text,
	"voice_profile" text,
	"style_notes" text,
	"preferred_frameworks" jsonb DEFAULT '[]'::jsonb,
	"content_angles" jsonb,
	"email" varchar(256),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fathom_access_token" text,
	"fathom_refresh_token" text,
	"fathom_token_expires_at" timestamp,
	"fathom_user_id" varchar(128),
	"fathom_user_email" varchar(256),
	"fathom_connected_at" timestamp,
	"fathom_last_synced_at" timestamp,
	"linkedin_access_token" text,
	"linkedin_refresh_token" text,
	"linkedin_token_expires_at" timestamp,
	"linkedin_member_id" varchar(128),
	"linkedin_member_name" varchar(256),
	"linkedin_connected_at" timestamp,
	"linkedin_last_synced_at" timestamp,
	"google_access_token" text,
	"google_refresh_token" text,
	"google_token_expires_at" timestamp,
	"google_user_email" varchar(256),
	"google_connected_at" timestamp,
	"google_last_synced_at" timestamp,
	"performance_learning_hints" text,
	"performance_learning_updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_angles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "design_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"objective" text NOT NULL,
	"target_audience" text NOT NULL,
	"tone" text NOT NULL,
	"key_messages" jsonb DEFAULT '[]'::jsonb,
	"design_direction" text NOT NULL,
	"svg" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer,
	"signal_id" integer,
	"author_id" integer,
	"before" text NOT NULL,
	"after" text NOT NULL,
	"edit_type" varchar(32) NOT NULL,
	"instruction" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frameworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"prompt_template" text NOT NULL,
	"best_for" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" varchar(64) NOT NULL,
	"author_id" integer,
	"provider" varchar(32) DEFAULT 'fathom',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"signal_id" integer,
	"author_id" integer,
	"framework_id" integer,
	"content_angle" text,
	"content" text NOT NULL,
	"original_content" text NOT NULL,
	"hook_strength_score" integer,
	"specificity_score" integer,
	"clarity_score" integer,
	"emotional_resonance_score" integer,
	"call_to_action_score" integer,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"reviewer_notes" text,
	"scheduled_for" timestamp,
	"published_at" timestamp,
	"linkedin_post_urn" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(256) NOT NULL,
	"token" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(256),
	"raw_content" text NOT NULL,
	"hashtags" jsonb DEFAULT '[]'::jsonb,
	"content_type" varchar(64) NOT NULL,
	"vertical" varchar(64),
	"source" varchar(64) DEFAULT 'manual',
	"source_meeting_id" varchar(128),
	"source_meeting_title" text,
	"source_meeting_date" timestamp,
	"speaker" varchar(128),
	"content_angles" jsonb DEFAULT '[]'::jsonb,
	"recommended_author_id" integer,
	"best_framework_id" integer,
	"source_transcript" text,
	"source_excerpt" text,
	"transcript_id" integer,
	"hook_strength_score" integer,
	"specificity_score" integer,
	"clarity_score" integer,
	"emotional_resonance_score" integer,
	"call_to_action_score" integer,
	"status" "signal_status" DEFAULT 'unused' NOT NULL,
	"notes" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"source" varchar(64) DEFAULT 'manual' NOT NULL,
	"source_meeting_id" varchar(128),
	"source_meeting_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(256) NOT NULL,
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"password_hash" text,
	"active" boolean DEFAULT false NOT NULL,
	"author_id" integer,
	"invited_by" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics" ADD CONSTRAINT "analytics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "author_content_angles" ADD CONSTRAINT "author_content_angles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "author_content_angles" ADD CONSTRAINT "author_content_angles_content_angle_id_content_angles_id_fk" FOREIGN KEY ("content_angle_id") REFERENCES "public"."content_angles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "design_briefs" ADD CONSTRAINT "design_briefs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "edits" ADD CONSTRAINT "edits_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "edits" ADD CONSTRAINT "edits_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "edits" ADD CONSTRAINT "edits_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "signals" ADD CONSTRAINT "signals_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_tokens_token_idx" ON "auth_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_angles_name_idx" ON "content_angles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_states_state_idx" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_id_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_status_idx" ON "posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_status_idx" ON "posts" USING btree ("author_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_email_idx" ON "sessions" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signals_status_idx" ON "signals" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signals_created_at_idx" ON "signals" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");