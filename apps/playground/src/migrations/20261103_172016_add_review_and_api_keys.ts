import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_proposals_kind" AS ENUM('enrich', 'draft', 'edit', 'field-action');
  CREATE TYPE "public"."enum_proposals_status" AS ENUM('open', 'accepted', 'partial', 'rejected', 'superseded');
  CREATE TYPE "public"."enum__proposals_v_version_kind" AS ENUM('enrich', 'draft', 'edit', 'field-action');
  CREATE TYPE "public"."enum__proposals_v_version_status" AS ENUM('open', 'accepted', 'partial', 'rejected', 'superseded');
  CREATE TYPE "public"."enum_runs_status" AS ENUM('queued', 'running', 'waiting', 'done', 'failed', 'cancelled');
  CREATE TYPE "public"."enum__runs_v_version_status" AS ENUM('queued', 'running', 'waiting', 'done', 'failed', 'cancelled');
  CREATE TABLE "proposals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_proposals_kind",
  	"status" "enum_proposals_status" DEFAULT 'open' NOT NULL,
  	"target_collection" varchar NOT NULL,
  	"target_id" varchar,
  	"patch" jsonb NOT NULL,
  	"decisions" jsonb,
  	"summary" varchar,
  	"run_id" integer,
  	"agent" varchar,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "proposals_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "_proposals_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_kind" "enum__proposals_v_version_kind",
  	"version_status" "enum__proposals_v_version_status" DEFAULT 'open' NOT NULL,
  	"version_target_collection" varchar NOT NULL,
  	"version_target_id" varchar,
  	"version_patch" jsonb NOT NULL,
  	"version_decisions" jsonb,
  	"version_summary" varchar,
  	"version_run_id" integer,
  	"version_agent" varchar,
  	"version_reviewed_by_id" integer,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_proposals_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" varchar NOT NULL,
  	"status" "enum_runs_status" DEFAULT 'queued' NOT NULL,
  	"target_collection" varchar,
  	"target_id" varchar,
  	"input" jsonb,
  	"stage" varchar,
  	"now" varchar,
  	"steps" jsonb,
  	"question" jsonb,
  	"answer" varchar,
  	"cost_usd" numeric,
  	"attempts" numeric DEFAULT 0,
  	"lease_until" timestamp(3) with time zone,
  	"session" varchar,
  	"model" varchar,
  	"error" varchar,
  	"triggered_by_id" integer,
  	"proposal_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "runs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "_runs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_kind" varchar NOT NULL,
  	"version_status" "enum__runs_v_version_status" DEFAULT 'queued' NOT NULL,
  	"version_target_collection" varchar,
  	"version_target_id" varchar,
  	"version_input" jsonb,
  	"version_stage" varchar,
  	"version_now" varchar,
  	"version_steps" jsonb,
  	"version_question" jsonb,
  	"version_answer" varchar,
  	"version_cost_usd" numeric,
  	"version_attempts" numeric DEFAULT 0,
  	"version_lease_until" timestamp(3) with time zone,
  	"version_session" varchar,
  	"version_model" varchar,
  	"version_error" varchar,
  	"version_triggered_by_id" integer,
  	"version_proposal_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_runs_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "payload_mcp_api_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"allow_read" boolean DEFAULT true,
  	"allow_create" boolean DEFAULT true,
  	"allow_edit" boolean DEFAULT true,
  	"allow_delete" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"api_key" varchar,
  	"api_key_last4" varchar,
  	"api_key_index" varchar
  );
  
  CREATE TABLE "payload_mcp_api_keys_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  ALTER TABLE "pages_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "_pages_v_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "posts_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "_posts_v_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "people_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "_people_v_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "media_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "users_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "help_articles_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "_help_articles_v_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "proposals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "runs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "payload_llm_instructions_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "site_settings_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "_site_settings_v_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "proposals" ADD CONSTRAINT "proposals_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "proposals" ADD CONSTRAINT "proposals_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "proposals_rels" ADD CONSTRAINT "proposals_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "proposals_rels" ADD CONSTRAINT "proposals_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "proposals_rels" ADD CONSTRAINT "proposals_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_proposals_v" ADD CONSTRAINT "_proposals_v_parent_id_proposals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_proposals_v" ADD CONSTRAINT "_proposals_v_version_run_id_runs_id_fk" FOREIGN KEY ("version_run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_proposals_v" ADD CONSTRAINT "_proposals_v_version_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_proposals_v_rels" ADD CONSTRAINT "_proposals_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_proposals_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_proposals_v_rels" ADD CONSTRAINT "_proposals_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_proposals_v_rels" ADD CONSTRAINT "_proposals_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "runs" ADD CONSTRAINT "runs_triggered_by_id_users_id_fk" FOREIGN KEY ("triggered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "runs" ADD CONSTRAINT "runs_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "runs_rels" ADD CONSTRAINT "runs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "runs_rels" ADD CONSTRAINT "runs_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "runs_rels" ADD CONSTRAINT "runs_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_runs_v" ADD CONSTRAINT "_runs_v_parent_id_runs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_runs_v" ADD CONSTRAINT "_runs_v_version_triggered_by_id_users_id_fk" FOREIGN KEY ("version_triggered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_runs_v" ADD CONSTRAINT "_runs_v_version_proposal_id_proposals_id_fk" FOREIGN KEY ("version_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_runs_v_rels" ADD CONSTRAINT "_runs_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_runs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_runs_v_rels" ADD CONSTRAINT "_runs_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_runs_v_rels" ADD CONSTRAINT "_runs_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys_rels" ADD CONSTRAINT "payload_mcp_api_keys_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys_rels" ADD CONSTRAINT "payload_mcp_api_keys_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys_rels" ADD CONSTRAINT "payload_mcp_api_keys_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "proposals_kind_idx" ON "proposals" USING btree ("kind");
  CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");
  CREATE INDEX "proposals_target_collection_idx" ON "proposals" USING btree ("target_collection");
  CREATE INDEX "proposals_target_id_idx" ON "proposals" USING btree ("target_id");
  CREATE INDEX "proposals_run_idx" ON "proposals" USING btree ("run_id");
  CREATE INDEX "proposals_agent_idx" ON "proposals" USING btree ("agent");
  CREATE INDEX "proposals_reviewed_by_idx" ON "proposals" USING btree ("reviewed_by_id");
  CREATE INDEX "proposals_updated_at_idx" ON "proposals" USING btree ("updated_at");
  CREATE INDEX "proposals_created_at_idx" ON "proposals" USING btree ("created_at");
  CREATE INDEX "proposals_rels_order_idx" ON "proposals_rels" USING btree ("order");
  CREATE INDEX "proposals_rels_parent_idx" ON "proposals_rels" USING btree ("parent_id");
  CREATE INDEX "proposals_rels_path_idx" ON "proposals_rels" USING btree ("path");
  CREATE INDEX "proposals_rels_users_id_idx" ON "proposals_rels" USING btree ("users_id");
  CREATE INDEX "proposals_rels_payload_mcp_api_keys_id_idx" ON "proposals_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_proposals_v_parent_idx" ON "_proposals_v" USING btree ("parent_id");
  CREATE INDEX "_proposals_v_version_version_kind_idx" ON "_proposals_v" USING btree ("version_kind");
  CREATE INDEX "_proposals_v_version_version_status_idx" ON "_proposals_v" USING btree ("version_status");
  CREATE INDEX "_proposals_v_version_version_target_collection_idx" ON "_proposals_v" USING btree ("version_target_collection");
  CREATE INDEX "_proposals_v_version_version_target_id_idx" ON "_proposals_v" USING btree ("version_target_id");
  CREATE INDEX "_proposals_v_version_version_run_idx" ON "_proposals_v" USING btree ("version_run_id");
  CREATE INDEX "_proposals_v_version_version_agent_idx" ON "_proposals_v" USING btree ("version_agent");
  CREATE INDEX "_proposals_v_version_version_reviewed_by_idx" ON "_proposals_v" USING btree ("version_reviewed_by_id");
  CREATE INDEX "_proposals_v_version_version_updated_at_idx" ON "_proposals_v" USING btree ("version_updated_at");
  CREATE INDEX "_proposals_v_version_version_created_at_idx" ON "_proposals_v" USING btree ("version_created_at");
  CREATE INDEX "_proposals_v_created_at_idx" ON "_proposals_v" USING btree ("created_at");
  CREATE INDEX "_proposals_v_updated_at_idx" ON "_proposals_v" USING btree ("updated_at");
  CREATE INDEX "_proposals_v_rels_order_idx" ON "_proposals_v_rels" USING btree ("order");
  CREATE INDEX "_proposals_v_rels_parent_idx" ON "_proposals_v_rels" USING btree ("parent_id");
  CREATE INDEX "_proposals_v_rels_path_idx" ON "_proposals_v_rels" USING btree ("path");
  CREATE INDEX "_proposals_v_rels_users_id_idx" ON "_proposals_v_rels" USING btree ("users_id");
  CREATE INDEX "_proposals_v_rels_payload_mcp_api_keys_id_idx" ON "_proposals_v_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "runs_kind_idx" ON "runs" USING btree ("kind");
  CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");
  CREATE INDEX "runs_target_collection_idx" ON "runs" USING btree ("target_collection");
  CREATE INDEX "runs_target_id_idx" ON "runs" USING btree ("target_id");
  CREATE INDEX "runs_triggered_by_idx" ON "runs" USING btree ("triggered_by_id");
  CREATE INDEX "runs_proposal_idx" ON "runs" USING btree ("proposal_id");
  CREATE INDEX "runs_updated_at_idx" ON "runs" USING btree ("updated_at");
  CREATE INDEX "runs_created_at_idx" ON "runs" USING btree ("created_at");
  CREATE INDEX "runs_rels_order_idx" ON "runs_rels" USING btree ("order");
  CREATE INDEX "runs_rels_parent_idx" ON "runs_rels" USING btree ("parent_id");
  CREATE INDEX "runs_rels_path_idx" ON "runs_rels" USING btree ("path");
  CREATE INDEX "runs_rels_users_id_idx" ON "runs_rels" USING btree ("users_id");
  CREATE INDEX "runs_rels_payload_mcp_api_keys_id_idx" ON "runs_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_runs_v_parent_idx" ON "_runs_v" USING btree ("parent_id");
  CREATE INDEX "_runs_v_version_version_kind_idx" ON "_runs_v" USING btree ("version_kind");
  CREATE INDEX "_runs_v_version_version_status_idx" ON "_runs_v" USING btree ("version_status");
  CREATE INDEX "_runs_v_version_version_target_collection_idx" ON "_runs_v" USING btree ("version_target_collection");
  CREATE INDEX "_runs_v_version_version_target_id_idx" ON "_runs_v" USING btree ("version_target_id");
  CREATE INDEX "_runs_v_version_version_triggered_by_idx" ON "_runs_v" USING btree ("version_triggered_by_id");
  CREATE INDEX "_runs_v_version_version_proposal_idx" ON "_runs_v" USING btree ("version_proposal_id");
  CREATE INDEX "_runs_v_version_version_updated_at_idx" ON "_runs_v" USING btree ("version_updated_at");
  CREATE INDEX "_runs_v_version_version_created_at_idx" ON "_runs_v" USING btree ("version_created_at");
  CREATE INDEX "_runs_v_created_at_idx" ON "_runs_v" USING btree ("created_at");
  CREATE INDEX "_runs_v_updated_at_idx" ON "_runs_v" USING btree ("updated_at");
  CREATE INDEX "_runs_v_rels_order_idx" ON "_runs_v_rels" USING btree ("order");
  CREATE INDEX "_runs_v_rels_parent_idx" ON "_runs_v_rels" USING btree ("parent_id");
  CREATE INDEX "_runs_v_rels_path_idx" ON "_runs_v_rels" USING btree ("path");
  CREATE INDEX "_runs_v_rels_users_id_idx" ON "_runs_v_rels" USING btree ("users_id");
  CREATE INDEX "_runs_v_rels_payload_mcp_api_keys_id_idx" ON "_runs_v_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  CREATE INDEX "payload_mcp_api_keys_rels_order_idx" ON "payload_mcp_api_keys_rels" USING btree ("order");
  CREATE INDEX "payload_mcp_api_keys_rels_parent_idx" ON "payload_mcp_api_keys_rels" USING btree ("parent_id");
  CREATE INDEX "payload_mcp_api_keys_rels_path_idx" ON "payload_mcp_api_keys_rels" USING btree ("path");
  CREATE INDEX "payload_mcp_api_keys_rels_users_id_idx" ON "payload_mcp_api_keys_rels" USING btree ("users_id");
  CREATE INDEX "payload_mcp_api_keys_rels_payload_mcp_api_keys_id_idx" ON "payload_mcp_api_keys_rels" USING btree ("payload_mcp_api_keys_id");
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_people_v_rels" ADD CONSTRAINT "_people_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "help_articles_rels" ADD CONSTRAINT "help_articles_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_help_articles_v_rels" ADD CONSTRAINT "_help_articles_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_proposals_fk" FOREIGN KEY ("proposals_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_runs_fk" FOREIGN KEY ("runs_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_llm_instructions_rels" ADD CONSTRAINT "payload_llm_instructions_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_settings_v_rels" ADD CONSTRAINT "_site_settings_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_rels_payload_mcp_api_keys_id_idx" ON "pages_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_pages_v_rels_payload_mcp_api_keys_id_idx" ON "_pages_v_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "posts_rels_payload_mcp_api_keys_id_idx" ON "posts_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_posts_v_rels_payload_mcp_api_keys_id_idx" ON "_posts_v_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "people_rels_payload_mcp_api_keys_id_idx" ON "people_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_people_v_rels_payload_mcp_api_keys_id_idx" ON "_people_v_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "media_rels_payload_mcp_api_keys_id_idx" ON "media_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "users_rels_payload_mcp_api_keys_id_idx" ON "users_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "help_articles_rels_payload_mcp_api_keys_id_idx" ON "help_articles_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_help_articles_v_rels_payload_mcp_api_keys_id_idx" ON "_help_articles_v_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_locked_documents_rels_proposals_id_idx" ON "payload_locked_documents_rels" USING btree ("proposals_id");
  CREATE INDEX "payload_locked_documents_rels_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("runs_id");
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_llm_instructions_rels_payload_mcp_api_keys_id_idx" ON "payload_llm_instructions_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "site_settings_rels_payload_mcp_api_keys_id_idx" ON "site_settings_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_site_settings_v_rels_payload_mcp_api_keys_id_idx" ON "_site_settings_v_rels" USING btree ("payload_mcp_api_keys_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "proposals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "proposals_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_proposals_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_proposals_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "runs_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_runs_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_runs_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_mcp_api_keys" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_mcp_api_keys_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "proposals" CASCADE;
  DROP TABLE "proposals_rels" CASCADE;
  DROP TABLE "_proposals_v" CASCADE;
  DROP TABLE "_proposals_v_rels" CASCADE;
  DROP TABLE "runs" CASCADE;
  DROP TABLE "runs_rels" CASCADE;
  DROP TABLE "_runs_v" CASCADE;
  DROP TABLE "_runs_v_rels" CASCADE;
  DROP TABLE "payload_mcp_api_keys" CASCADE;
  DROP TABLE "payload_mcp_api_keys_rels" CASCADE;
  ALTER TABLE "pages_rels" DROP CONSTRAINT "pages_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "_pages_v_rels" DROP CONSTRAINT "_pages_v_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "people_rels" DROP CONSTRAINT "people_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "_people_v_rels" DROP CONSTRAINT "_people_v_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "media_rels" DROP CONSTRAINT "media_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "users_rels" DROP CONSTRAINT "users_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "help_articles_rels" DROP CONSTRAINT "help_articles_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "_help_articles_v_rels" DROP CONSTRAINT "_help_articles_v_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_proposals_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_runs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "payload_llm_instructions_rels" DROP CONSTRAINT "payload_llm_instructions_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "site_settings_rels" DROP CONSTRAINT "site_settings_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "_site_settings_v_rels" DROP CONSTRAINT "_site_settings_v_rels_payload_mcp_api_keys_fk";
  
  DROP INDEX "pages_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "_pages_v_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "posts_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "_posts_v_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "people_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "_people_v_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "media_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "users_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "help_articles_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "_help_articles_v_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "payload_locked_documents_rels_proposals_id_idx";
  DROP INDEX "payload_locked_documents_rels_runs_id_idx";
  DROP INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "payload_llm_instructions_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "site_settings_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "_site_settings_v_rels_payload_mcp_api_keys_id_idx";
  ALTER TABLE "pages_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "posts_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "_posts_v_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "people_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "_people_v_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "media_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "users_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "help_articles_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "_help_articles_v_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "proposals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "runs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "payload_llm_instructions_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "site_settings_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "_site_settings_v_rels" DROP COLUMN "payload_mcp_api_keys_id";
  DROP TYPE "public"."enum_proposals_kind";
  DROP TYPE "public"."enum_proposals_status";
  DROP TYPE "public"."enum__proposals_v_version_kind";
  DROP TYPE "public"."enum__proposals_v_version_status";
  DROP TYPE "public"."enum_runs_status";
  DROP TYPE "public"."enum__runs_v_version_status";`)
}
