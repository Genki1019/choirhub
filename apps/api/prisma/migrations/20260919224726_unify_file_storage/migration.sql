-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('score', 'concert', 'event', 'org_document');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('bylaws', 'minutes', 'member_guide', 'finance_report', 'other');

-- CreateTable: 共有ファイルコアテーブル
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 団体共有資料（新規）
CREATE TABLE "org_documents" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "access_level" "AccessLevel" NOT NULL DEFAULT 'restricted',

    CONSTRAINT "org_documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_documents" ADD CONSTRAINT "org_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "stored_files_org_id_kind_idx" ON "stored_files"("org_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "org_documents_file_id_key" ON "org_documents"("file_id");

-- ────────────────────────────
-- 既存データ移行: score_files → stored_files
-- ────────────────────────────

ALTER TABLE "score_files" ADD COLUMN "file_id" TEXT;

WITH inserted AS (
    INSERT INTO "stored_files" ("id", "org_id", "kind", "storage_key", "file_name", "uploaded_by", "uploaded_at")
    SELECT gen_random_uuid()::text, "s"."org_id", 'score', "sf"."storage_key", "sf"."file_name", "sf"."uploaded_by", "sf"."uploaded_at"
    FROM "score_files" "sf"
    JOIN "scores" "s" ON "s"."id" = "sf"."score_id"
    RETURNING "id", "storage_key"
)
UPDATE "score_files" "sf"
SET "file_id" = "inserted"."id"
FROM "inserted"
WHERE "sf"."storage_key" = "inserted"."storage_key";

ALTER TABLE "score_files" ALTER COLUMN "file_id" SET NOT NULL;
ALTER TABLE "score_files" DROP COLUMN "file_name",
DROP COLUMN "storage_key",
DROP COLUMN "uploaded_at",
DROP COLUMN "uploaded_by";
CREATE UNIQUE INDEX "score_files_file_id_key" ON "score_files"("file_id");
ALTER TABLE "score_files" ADD CONSTRAINT "score_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ────────────────────────────
-- 既存データ移行: concert_files → stored_files
-- ────────────────────────────

ALTER TABLE "concert_files" ADD COLUMN "file_id" TEXT;

WITH inserted AS (
    INSERT INTO "stored_files" ("id", "org_id", "kind", "storage_key", "file_name", "uploaded_by", "uploaded_at")
    SELECT gen_random_uuid()::text, "c"."org_id", 'concert', "cf"."storage_key", "cf"."file_name", "cf"."uploaded_by", "cf"."uploaded_at"
    FROM "concert_files" "cf"
    JOIN "concerts" "c" ON "c"."id" = "cf"."concert_id"
    RETURNING "id", "storage_key"
)
UPDATE "concert_files" "cf"
SET "file_id" = "inserted"."id"
FROM "inserted"
WHERE "cf"."storage_key" = "inserted"."storage_key";

ALTER TABLE "concert_files" ALTER COLUMN "file_id" SET NOT NULL;
ALTER TABLE "concert_files" DROP COLUMN "file_name",
DROP COLUMN "storage_key",
DROP COLUMN "uploaded_at",
DROP COLUMN "uploaded_by";
CREATE UNIQUE INDEX "concert_files_file_id_key" ON "concert_files"("file_id");
ALTER TABLE "concert_files" ADD CONSTRAINT "concert_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ────────────────────────────
-- 既存データ移行: event_files → stored_files
-- ────────────────────────────

ALTER TABLE "event_files" ADD COLUMN "file_id" TEXT;

WITH inserted AS (
    INSERT INTO "stored_files" ("id", "org_id", "kind", "storage_key", "file_name", "uploaded_by", "uploaded_at")
    SELECT gen_random_uuid()::text, "e"."org_id", 'event', "ef"."storage_key", "ef"."file_name", "ef"."uploaded_by", "ef"."uploaded_at"
    FROM "event_files" "ef"
    JOIN "events" "e" ON "e"."id" = "ef"."event_id"
    RETURNING "id", "storage_key"
)
UPDATE "event_files" "ef"
SET "file_id" = "inserted"."id"
FROM "inserted"
WHERE "ef"."storage_key" = "inserted"."storage_key";

ALTER TABLE "event_files" ALTER COLUMN "file_id" SET NOT NULL;
ALTER TABLE "event_files" DROP COLUMN "file_name",
DROP COLUMN "storage_key",
DROP COLUMN "uploaded_at",
DROP COLUMN "uploaded_by";
CREATE UNIQUE INDEX "event_files_file_id_key" ON "event_files"("file_id");
ALTER TABLE "event_files" ADD CONSTRAINT "event_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
