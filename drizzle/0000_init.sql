CREATE TABLE "checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"owner_id" uuid,
	"done" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"value" text,
	"by" uuid,
	"at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"label" text DEFAULT 'Team invite' NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer DEFAULT 10 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "item_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"by" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"origin" text DEFAULT 'app' NOT NULL,
	"sha" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"label" text NOT NULL,
	"angles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'plan' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"winner_option_id" integer,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_hits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_hits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "role_cells" (
	"pkg" text NOT NULL,
	"person" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "role_cells_pkg_person_pk" PRIMARY KEY("pkg","person")
);
--> statement-breakpoint
CREATE TABLE "stances" (
	"target" text NOT NULL,
	"user_id" uuid NOT NULL,
	"stance" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stances_target_user_id_pk" PRIMARY KEY("target","user_id")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer,
	"kind" text NOT NULL,
	"type" text DEFAULT 'edit' NOT NULL,
	"proposed" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"author_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"reply" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"tz" text DEFAULT 'UTC' NOT NULL,
	"invite_id" integer,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "items_kind_slug" ON "items" USING btree ("kind","slug");--> statement-breakpoint
CREATE INDEX "items_kind" ON "items" USING btree ("kind");