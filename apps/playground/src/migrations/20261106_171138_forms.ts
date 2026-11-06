import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_blocks_text_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum_forms_blocks_email_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum_forms_blocks_phone_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum_forms_blocks_textarea_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum_forms_blocks_select_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum_forms_blocks_checkbox_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum__forms_v_blocks_text_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum__forms_v_blocks_email_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum__forms_v_blocks_phone_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum__forms_v_blocks_textarea_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum__forms_v_blocks_select_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum__forms_v_blocks_checkbox_width" AS ENUM('full', 'half');
  CREATE TYPE "public"."enum_form_submissions_status" AS ENUM('new', 'handled', 'spam');
  CREATE TYPE "public"."enum__form_submissions_v_version_status" AS ENUM('new', 'handled', 'spam');
  ALTER TYPE "public"."enum_help_articles_topic" ADD VALUE 'Forms' BEFORE 'Events';
  ALTER TYPE "public"."enum__help_articles_v_version_topic" ADD VALUE 'Forms' BEFORE 'Events';
  ALTER TYPE "public"."enum_payload_query_presets_related_collection" ADD VALUE 'forms' BEFORE 'events';
  ALTER TYPE "public"."enum_payload_query_presets_related_collection" ADD VALUE 'form-submissions' BEFORE 'events';
  CREATE TABLE "pages_blocks_form_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"heading" varchar,
  	"intro" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_form_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"heading" varchar,
  	"intro" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum_forms_blocks_text_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_email" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum_forms_blocks_email_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_phone" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum_forms_blocks_phone_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_textarea" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum_forms_blocks_textarea_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_select_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"required" boolean,
  	"width" "enum_forms_blocks_select_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_checkbox" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"required" boolean,
  	"width" "enum_forms_blocks_checkbox_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_notify" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE "forms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"submit_label" varchar DEFAULT 'Send',
  	"confirmation" varchar DEFAULT 'Thanks, we got your message and will be in touch.',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "forms_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "_forms_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum__forms_v_blocks_text_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_forms_v_blocks_email" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum__forms_v_blocks_email_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_forms_v_blocks_phone" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum__forms_v_blocks_phone_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_forms_v_blocks_textarea" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"placeholder" varchar,
  	"required" boolean,
  	"width" "enum__forms_v_blocks_textarea_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_forms_v_blocks_select_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_forms_v_blocks_select" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"required" boolean,
  	"width" "enum__forms_v_blocks_select_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_forms_v_blocks_checkbox" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"required" boolean,
  	"width" "enum__forms_v_blocks_checkbox_width" DEFAULT 'full',
  	"help" varchar,
  	"key" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_forms_v_version_notify" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_forms_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_submit_label" varchar DEFAULT 'Send',
  	"version_confirmation" varchar DEFAULT 'Thanks, we got your message and will be in touch.',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_forms_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "form_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar,
  	"answers" jsonb,
  	"status" "enum_form_submissions_status" DEFAULT 'new',
  	"form_id" integer,
  	"page" varchar,
  	"sender" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "form_submissions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "_form_submissions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_summary" varchar,
  	"version_answers" jsonb,
  	"version_status" "enum__form_submissions_v_version_status" DEFAULT 'new',
  	"version_form_id" integer,
  	"version_page" varchar,
  	"version_sender" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_form_submissions_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "forms_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "form_submissions_id" integer;
  ALTER TABLE "pages_blocks_form_block" ADD CONSTRAINT "pages_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_form_block" ADD CONSTRAINT "pages_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_form_block" ADD CONSTRAINT "_pages_v_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_form_block" ADD CONSTRAINT "_pages_v_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_text" ADD CONSTRAINT "forms_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_email" ADD CONSTRAINT "forms_blocks_email_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_phone" ADD CONSTRAINT "forms_blocks_phone_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_textarea" ADD CONSTRAINT "forms_blocks_textarea_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_options" ADD CONSTRAINT "forms_blocks_select_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select" ADD CONSTRAINT "forms_blocks_select_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox" ADD CONSTRAINT "forms_blocks_checkbox_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_notify" ADD CONSTRAINT "forms_notify_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_rels" ADD CONSTRAINT "forms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_rels" ADD CONSTRAINT "forms_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_rels" ADD CONSTRAINT "forms_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_blocks_text" ADD CONSTRAINT "_forms_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_blocks_email" ADD CONSTRAINT "_forms_v_blocks_email_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_blocks_phone" ADD CONSTRAINT "_forms_v_blocks_phone_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_blocks_textarea" ADD CONSTRAINT "_forms_v_blocks_textarea_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_blocks_select_options" ADD CONSTRAINT "_forms_v_blocks_select_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_blocks_select" ADD CONSTRAINT "_forms_v_blocks_select_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_blocks_checkbox" ADD CONSTRAINT "_forms_v_blocks_checkbox_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_version_notify" ADD CONSTRAINT "_forms_v_version_notify_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v" ADD CONSTRAINT "_forms_v_parent_id_forms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_forms_v_rels" ADD CONSTRAINT "_forms_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_forms_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_rels" ADD CONSTRAINT "_forms_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_forms_v_rels" ADD CONSTRAINT "_forms_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_form_submissions_v" ADD CONSTRAINT "_form_submissions_v_parent_id_form_submissions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_form_submissions_v" ADD CONSTRAINT "_form_submissions_v_version_form_id_forms_id_fk" FOREIGN KEY ("version_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_form_submissions_v_rels" ADD CONSTRAINT "_form_submissions_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_form_submissions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_form_submissions_v_rels" ADD CONSTRAINT "_form_submissions_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_form_submissions_v_rels" ADD CONSTRAINT "_form_submissions_v_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_form_block_order_idx" ON "pages_blocks_form_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_form_block_parent_id_idx" ON "pages_blocks_form_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_form_block_path_idx" ON "pages_blocks_form_block" USING btree ("_path");
  CREATE INDEX "pages_blocks_form_block_form_idx" ON "pages_blocks_form_block" USING btree ("form_id");
  CREATE INDEX "_pages_v_blocks_form_block_order_idx" ON "_pages_v_blocks_form_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_form_block_parent_id_idx" ON "_pages_v_blocks_form_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_form_block_path_idx" ON "_pages_v_blocks_form_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_form_block_form_idx" ON "_pages_v_blocks_form_block" USING btree ("form_id");
  CREATE INDEX "forms_blocks_text_order_idx" ON "forms_blocks_text" USING btree ("_order");
  CREATE INDEX "forms_blocks_text_parent_id_idx" ON "forms_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_text_path_idx" ON "forms_blocks_text" USING btree ("_path");
  CREATE INDEX "forms_blocks_email_order_idx" ON "forms_blocks_email" USING btree ("_order");
  CREATE INDEX "forms_blocks_email_parent_id_idx" ON "forms_blocks_email" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_email_path_idx" ON "forms_blocks_email" USING btree ("_path");
  CREATE INDEX "forms_blocks_phone_order_idx" ON "forms_blocks_phone" USING btree ("_order");
  CREATE INDEX "forms_blocks_phone_parent_id_idx" ON "forms_blocks_phone" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_phone_path_idx" ON "forms_blocks_phone" USING btree ("_path");
  CREATE INDEX "forms_blocks_textarea_order_idx" ON "forms_blocks_textarea" USING btree ("_order");
  CREATE INDEX "forms_blocks_textarea_parent_id_idx" ON "forms_blocks_textarea" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_textarea_path_idx" ON "forms_blocks_textarea" USING btree ("_path");
  CREATE INDEX "forms_blocks_select_options_order_idx" ON "forms_blocks_select_options" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_options_parent_id_idx" ON "forms_blocks_select_options" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_order_idx" ON "forms_blocks_select" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_parent_id_idx" ON "forms_blocks_select" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_path_idx" ON "forms_blocks_select" USING btree ("_path");
  CREATE INDEX "forms_blocks_checkbox_order_idx" ON "forms_blocks_checkbox" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_parent_id_idx" ON "forms_blocks_checkbox" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_path_idx" ON "forms_blocks_checkbox" USING btree ("_path");
  CREATE INDEX "forms_notify_order_idx" ON "forms_notify" USING btree ("_order");
  CREATE INDEX "forms_notify_parent_id_idx" ON "forms_notify" USING btree ("_parent_id");
  CREATE INDEX "forms_updated_at_idx" ON "forms" USING btree ("updated_at");
  CREATE INDEX "forms_created_at_idx" ON "forms" USING btree ("created_at");
  CREATE INDEX "forms_rels_order_idx" ON "forms_rels" USING btree ("order");
  CREATE INDEX "forms_rels_parent_idx" ON "forms_rels" USING btree ("parent_id");
  CREATE INDEX "forms_rels_path_idx" ON "forms_rels" USING btree ("path");
  CREATE INDEX "forms_rels_users_id_idx" ON "forms_rels" USING btree ("users_id");
  CREATE INDEX "forms_rels_payload_mcp_api_keys_id_idx" ON "forms_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_forms_v_blocks_text_order_idx" ON "_forms_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_forms_v_blocks_text_parent_id_idx" ON "_forms_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_blocks_text_path_idx" ON "_forms_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_forms_v_blocks_email_order_idx" ON "_forms_v_blocks_email" USING btree ("_order");
  CREATE INDEX "_forms_v_blocks_email_parent_id_idx" ON "_forms_v_blocks_email" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_blocks_email_path_idx" ON "_forms_v_blocks_email" USING btree ("_path");
  CREATE INDEX "_forms_v_blocks_phone_order_idx" ON "_forms_v_blocks_phone" USING btree ("_order");
  CREATE INDEX "_forms_v_blocks_phone_parent_id_idx" ON "_forms_v_blocks_phone" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_blocks_phone_path_idx" ON "_forms_v_blocks_phone" USING btree ("_path");
  CREATE INDEX "_forms_v_blocks_textarea_order_idx" ON "_forms_v_blocks_textarea" USING btree ("_order");
  CREATE INDEX "_forms_v_blocks_textarea_parent_id_idx" ON "_forms_v_blocks_textarea" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_blocks_textarea_path_idx" ON "_forms_v_blocks_textarea" USING btree ("_path");
  CREATE INDEX "_forms_v_blocks_select_options_order_idx" ON "_forms_v_blocks_select_options" USING btree ("_order");
  CREATE INDEX "_forms_v_blocks_select_options_parent_id_idx" ON "_forms_v_blocks_select_options" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_blocks_select_order_idx" ON "_forms_v_blocks_select" USING btree ("_order");
  CREATE INDEX "_forms_v_blocks_select_parent_id_idx" ON "_forms_v_blocks_select" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_blocks_select_path_idx" ON "_forms_v_blocks_select" USING btree ("_path");
  CREATE INDEX "_forms_v_blocks_checkbox_order_idx" ON "_forms_v_blocks_checkbox" USING btree ("_order");
  CREATE INDEX "_forms_v_blocks_checkbox_parent_id_idx" ON "_forms_v_blocks_checkbox" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_blocks_checkbox_path_idx" ON "_forms_v_blocks_checkbox" USING btree ("_path");
  CREATE INDEX "_forms_v_version_notify_order_idx" ON "_forms_v_version_notify" USING btree ("_order");
  CREATE INDEX "_forms_v_version_notify_parent_id_idx" ON "_forms_v_version_notify" USING btree ("_parent_id");
  CREATE INDEX "_forms_v_parent_idx" ON "_forms_v" USING btree ("parent_id");
  CREATE INDEX "_forms_v_version_version_updated_at_idx" ON "_forms_v" USING btree ("version_updated_at");
  CREATE INDEX "_forms_v_version_version_created_at_idx" ON "_forms_v" USING btree ("version_created_at");
  CREATE INDEX "_forms_v_created_at_idx" ON "_forms_v" USING btree ("created_at");
  CREATE INDEX "_forms_v_updated_at_idx" ON "_forms_v" USING btree ("updated_at");
  CREATE INDEX "_forms_v_rels_order_idx" ON "_forms_v_rels" USING btree ("order");
  CREATE INDEX "_forms_v_rels_parent_idx" ON "_forms_v_rels" USING btree ("parent_id");
  CREATE INDEX "_forms_v_rels_path_idx" ON "_forms_v_rels" USING btree ("path");
  CREATE INDEX "_forms_v_rels_users_id_idx" ON "_forms_v_rels" USING btree ("users_id");
  CREATE INDEX "_forms_v_rels_payload_mcp_api_keys_id_idx" ON "_forms_v_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "form_submissions_status_idx" ON "form_submissions" USING btree ("status");
  CREATE INDEX "form_submissions_form_idx" ON "form_submissions" USING btree ("form_id");
  CREATE INDEX "form_submissions_sender_idx" ON "form_submissions" USING btree ("sender");
  CREATE INDEX "form_submissions_updated_at_idx" ON "form_submissions" USING btree ("updated_at");
  CREATE INDEX "form_submissions_created_at_idx" ON "form_submissions" USING btree ("created_at");
  CREATE INDEX "form_submissions_rels_order_idx" ON "form_submissions_rels" USING btree ("order");
  CREATE INDEX "form_submissions_rels_parent_idx" ON "form_submissions_rels" USING btree ("parent_id");
  CREATE INDEX "form_submissions_rels_path_idx" ON "form_submissions_rels" USING btree ("path");
  CREATE INDEX "form_submissions_rels_users_id_idx" ON "form_submissions_rels" USING btree ("users_id");
  CREATE INDEX "form_submissions_rels_payload_mcp_api_keys_id_idx" ON "form_submissions_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "_form_submissions_v_parent_idx" ON "_form_submissions_v" USING btree ("parent_id");
  CREATE INDEX "_form_submissions_v_version_version_status_idx" ON "_form_submissions_v" USING btree ("version_status");
  CREATE INDEX "_form_submissions_v_version_version_form_idx" ON "_form_submissions_v" USING btree ("version_form_id");
  CREATE INDEX "_form_submissions_v_version_version_sender_idx" ON "_form_submissions_v" USING btree ("version_sender");
  CREATE INDEX "_form_submissions_v_version_version_updated_at_idx" ON "_form_submissions_v" USING btree ("version_updated_at");
  CREATE INDEX "_form_submissions_v_version_version_created_at_idx" ON "_form_submissions_v" USING btree ("version_created_at");
  CREATE INDEX "_form_submissions_v_created_at_idx" ON "_form_submissions_v" USING btree ("created_at");
  CREATE INDEX "_form_submissions_v_updated_at_idx" ON "_form_submissions_v" USING btree ("updated_at");
  CREATE INDEX "_form_submissions_v_rels_order_idx" ON "_form_submissions_v_rels" USING btree ("order");
  CREATE INDEX "_form_submissions_v_rels_parent_idx" ON "_form_submissions_v_rels" USING btree ("parent_id");
  CREATE INDEX "_form_submissions_v_rels_path_idx" ON "_form_submissions_v_rels" USING btree ("path");
  CREATE INDEX "_form_submissions_v_rels_users_id_idx" ON "_form_submissions_v_rels" USING btree ("users_id");
  CREATE INDEX "_form_submissions_v_rels_payload_mcp_api_keys_id_idx" ON "_form_submissions_v_rels" USING btree ("payload_mcp_api_keys_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forms_fk" FOREIGN KEY ("forms_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_submissions_fk" FOREIGN KEY ("form_submissions_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_forms_id_idx" ON "payload_locked_documents_rels" USING btree ("forms_id");
  CREATE INDEX "payload_locked_documents_rels_form_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("form_submissions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_email" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_phone" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_textarea" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_select_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_select" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_notify" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_blocks_email" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_blocks_phone" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_blocks_textarea" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_blocks_select_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_blocks_select" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_blocks_checkbox" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_version_notify" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_forms_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "form_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "form_submissions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_form_submissions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_form_submissions_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_form_block" CASCADE;
  DROP TABLE "_pages_v_blocks_form_block" CASCADE;
  DROP TABLE "forms_blocks_text" CASCADE;
  DROP TABLE "forms_blocks_email" CASCADE;
  DROP TABLE "forms_blocks_phone" CASCADE;
  DROP TABLE "forms_blocks_textarea" CASCADE;
  DROP TABLE "forms_blocks_select_options" CASCADE;
  DROP TABLE "forms_blocks_select" CASCADE;
  DROP TABLE "forms_blocks_checkbox" CASCADE;
  DROP TABLE "forms_notify" CASCADE;
  DROP TABLE "forms" CASCADE;
  DROP TABLE "forms_rels" CASCADE;
  DROP TABLE "_forms_v_blocks_text" CASCADE;
  DROP TABLE "_forms_v_blocks_email" CASCADE;
  DROP TABLE "_forms_v_blocks_phone" CASCADE;
  DROP TABLE "_forms_v_blocks_textarea" CASCADE;
  DROP TABLE "_forms_v_blocks_select_options" CASCADE;
  DROP TABLE "_forms_v_blocks_select" CASCADE;
  DROP TABLE "_forms_v_blocks_checkbox" CASCADE;
  DROP TABLE "_forms_v_version_notify" CASCADE;
  DROP TABLE "_forms_v" CASCADE;
  DROP TABLE "_forms_v_rels" CASCADE;
  DROP TABLE "form_submissions" CASCADE;
  DROP TABLE "form_submissions_rels" CASCADE;
  DROP TABLE "_form_submissions_v" CASCADE;
  DROP TABLE "_form_submissions_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_forms_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_form_submissions_fk";
  
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DATA TYPE text;
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DEFAULT 'Getting started'::text;
  DROP TYPE "public"."enum_help_articles_topic";
  CREATE TYPE "public"."enum_help_articles_topic" AS ENUM('Getting started', 'Content', 'Media', 'Account', 'Events');
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DEFAULT 'Getting started'::"public"."enum_help_articles_topic";
  ALTER TABLE "help_articles" ALTER COLUMN "topic" SET DATA TYPE "public"."enum_help_articles_topic" USING "topic"::"public"."enum_help_articles_topic";
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DATA TYPE text;
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DEFAULT 'Getting started'::text;
  DROP TYPE "public"."enum__help_articles_v_version_topic";
  CREATE TYPE "public"."enum__help_articles_v_version_topic" AS ENUM('Getting started', 'Content', 'Media', 'Account', 'Events');
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DEFAULT 'Getting started'::"public"."enum__help_articles_v_version_topic";
  ALTER TABLE "_help_articles_v" ALTER COLUMN "version_topic" SET DATA TYPE "public"."enum__help_articles_v_version_topic" USING "version_topic"::"public"."enum__help_articles_v_version_topic";
  ALTER TABLE "payload_query_presets" ALTER COLUMN "related_collection" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_query_presets_related_collection";
  CREATE TYPE "public"."enum_payload_query_presets_related_collection" AS ENUM('pages', 'posts', 'people', 'media', 'users', 'events', 'help-articles', 'proposals', 'runs', 'payload-mcp-api-keys');
  ALTER TABLE "payload_query_presets" ALTER COLUMN "related_collection" SET DATA TYPE "public"."enum_payload_query_presets_related_collection" USING "related_collection"::"public"."enum_payload_query_presets_related_collection";
  DROP INDEX "payload_locked_documents_rels_forms_id_idx";
  DROP INDEX "payload_locked_documents_rels_form_submissions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "forms_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "form_submissions_id";
  DROP TYPE "public"."enum_forms_blocks_text_width";
  DROP TYPE "public"."enum_forms_blocks_email_width";
  DROP TYPE "public"."enum_forms_blocks_phone_width";
  DROP TYPE "public"."enum_forms_blocks_textarea_width";
  DROP TYPE "public"."enum_forms_blocks_select_width";
  DROP TYPE "public"."enum_forms_blocks_checkbox_width";
  DROP TYPE "public"."enum__forms_v_blocks_text_width";
  DROP TYPE "public"."enum__forms_v_blocks_email_width";
  DROP TYPE "public"."enum__forms_v_blocks_phone_width";
  DROP TYPE "public"."enum__forms_v_blocks_textarea_width";
  DROP TYPE "public"."enum__forms_v_blocks_select_width";
  DROP TYPE "public"."enum__forms_v_blocks_checkbox_width";
  DROP TYPE "public"."enum_form_submissions_status";
  DROP TYPE "public"."enum__form_submissions_v_version_status";`)
}
