import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_proposals_kind" ADD VALUE 'translate' BEFORE 'field-action';
  ALTER TYPE "public"."enum__proposals_v_version_kind" ADD VALUE 'translate' BEFORE 'field-action';
  ALTER TABLE "proposals" ADD COLUMN "locale" varchar;
  ALTER TABLE "_proposals_v" ADD COLUMN "version_locale" varchar;
  CREATE INDEX "proposals_locale_idx" ON "proposals" USING btree ("locale");
  CREATE INDEX "_proposals_v_version_version_locale_idx" ON "_proposals_v" USING btree ("version_locale");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "proposals" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_proposals_kind";
  CREATE TYPE "public"."enum_proposals_kind" AS ENUM('enrich', 'draft', 'edit', 'field-action');
  ALTER TABLE "proposals" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_proposals_kind" USING "kind"::"public"."enum_proposals_kind";
  ALTER TABLE "_proposals_v" ALTER COLUMN "version_kind" SET DATA TYPE text;
  DROP TYPE "public"."enum__proposals_v_version_kind";
  CREATE TYPE "public"."enum__proposals_v_version_kind" AS ENUM('enrich', 'draft', 'edit', 'field-action');
  ALTER TABLE "_proposals_v" ALTER COLUMN "version_kind" SET DATA TYPE "public"."enum__proposals_v_version_kind" USING "version_kind"::"public"."enum__proposals_v_version_kind";
  DROP INDEX "proposals_locale_idx";
  DROP INDEX "_proposals_v_version_version_locale_idx";
  ALTER TABLE "proposals" DROP COLUMN "locale";
  ALTER TABLE "_proposals_v" DROP COLUMN "version_locale";`)
}
