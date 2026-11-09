import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_redirects_source" AS ENUM('manual', 'slug', 'import', 'missing');
  CREATE TYPE "public"."enum_missing_pages_status" AS ENUM('open', 'redirected', 'ignored');
  ALTER TYPE "public"."enum_help_articles_topic" ADD VALUE 'Website' BEFORE 'Events';
  ALTER TYPE "public"."enum__help_articles_v_version_topic" ADD VALUE 'Website' BEFORE 'Events';
  ALTER TYPE "public"."enum_payload_query_presets_related_collection" ADD VALUE 'redirects' BEFORE 'events';
  ALTER TYPE "public"."enum_payload_query_presets_related_collection" ADD VALUE 'missing-pages' BEFORE 'events';
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to" varchar NOT NULL,
  	"permanent" boolean DEFAULT true,
  	"note" varchar,
  	"source" "enum_redirects_source" DEFAULT 'manual',
  	"hits" numeric DEFAULT 0,
  	"last_hit_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "redirects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "missing_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"path" varchar NOT NULL,
  	"redirect_to" varchar,
  	"status" "enum_missing_pages_status" DEFAULT 'open',
  	"hits" numeric DEFAULT 0,
  	"last_seen_at" timestamp(3) with time zone,
  	"referrer" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "missing_pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "redirects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "missing_pages_id" integer;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "missing_pages_rels" ADD CONSTRAINT "missing_pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."missing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "missing_pages_rels" ADD CONSTRAINT "missing_pages_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "missing_pages_rels" ADD CONSTRAINT "missing_pages_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "redirects_rels_order_idx" ON "redirects_rels" USING btree ("order");
  CREATE INDEX "redirects_rels_parent_idx" ON "redirects_rels" USING btree ("parent_id");
  CREATE INDEX "redirects_rels_path_idx" ON "redirects_rels" USING btree ("path");
  CREATE INDEX "redirects_rels_users_id_idx" ON "redirects_rels" USING btree ("users_id");
  CREATE INDEX "redirects_rels_payload_mcp_api_keys_id_idx" ON "redirects_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE UNIQUE INDEX "missing_pages_path_idx" ON "missing_pages" USING btree ("path");
  CREATE INDEX "missing_pages_status_idx" ON "missing_pages" USING btree ("status");
  CREATE INDEX "missing_pages_hits_idx" ON "missing_pages" USING btree ("hits");
  CREATE INDEX "missing_pages_updated_at_idx" ON "missing_pages" USING btree ("updated_at");
  CREATE INDEX "missing_pages_created_at_idx" ON "missing_pages" USING btree ("created_at");
  CREATE INDEX "missing_pages_rels_order_idx" ON "missing_pages_rels" USING btree ("order");
  CREATE INDEX "missing_pages_rels_parent_idx" ON "missing_pages_rels" USING btree ("parent_id");
  CREATE INDEX "missing_pages_rels_path_idx" ON "missing_pages_rels" USING btree ("path");
  CREATE INDEX "missing_pages_rels_users_id_idx" ON "missing_pages_rels" USING btree ("users_id");
  CREATE INDEX "missing_pages_rels_payload_mcp_api_keys_id_idx" ON "missing_pages_rels" USING btree ("payload_mcp_api_keys_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_missing_pages_fk" FOREIGN KEY ("missing_pages_id") REFERENCES "public"."missing_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_locked_documents_rels_missing_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("missing_pages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "redirects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "redirects_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "missing_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "missing_pages_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "redirects_rels" CASCADE;
  DROP TABLE "missing_pages" CASCADE;
  DROP TABLE "missing_pages_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_redirects_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_missing_pages_fk";
  
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DATA TYPE text;
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DEFAULT 'Getting started'::text;
  DROP TYPE "public"."enum_help_articles_topic";
  CREATE TYPE "public"."enum_help_articles_topic" AS ENUM('Getting started', 'Content', 'Media', 'Account', 'Forms', 'Events');
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DEFAULT 'Getting started'::"public"."enum_help_articles_topic";
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DATA TYPE "public"."enum_help_articles_topic" USING "topic"::"public"."enum_help_articles_topic";
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DATA TYPE text;
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DEFAULT 'Getting started'::text;
  DROP TYPE "public"."enum__help_articles_v_version_topic";
  CREATE TYPE "public"."enum__help_articles_v_version_topic" AS ENUM('Getting started', 'Content', 'Media', 'Account', 'Forms', 'Events');
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DEFAULT 'Getting started'::"public"."enum__help_articles_v_version_topic";
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DATA TYPE "public"."enum__help_articles_v_version_topic" USING "version_topic"::"public"."enum__help_articles_v_version_topic";
  ALTER TABLE "payload_query_presets" ALTER COLUMN "related_collection" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_query_presets_related_collection";
  CREATE TYPE "public"."enum_payload_query_presets_related_collection" AS ENUM('pages', 'posts', 'people', 'media', 'users', 'forms', 'form-submissions', 'events', 'help-articles', 'proposals', 'runs', 'payload-mcp-api-keys');
  ALTER TABLE "payload_query_presets" ALTER COLUMN "related_collection" SET DATA TYPE "public"."enum_payload_query_presets_related_collection" USING "related_collection"::"public"."enum_payload_query_presets_related_collection";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_redirects_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_missing_pages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "redirects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "missing_pages_id";
  DROP TYPE "public"."enum_redirects_source";
  DROP TYPE "public"."enum_missing_pages_status";`)
}
