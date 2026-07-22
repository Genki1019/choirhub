-- 既存データを保持するため DROP+ADD ではなく RENAME COLUMN を使う
ALTER TABLE "events" RENAME COLUMN "page_memo" TO "other_notes";
ALTER TABLE "events" ADD COLUMN "rehearsal_content" TEXT;
ALTER TABLE "events" ADD COLUMN "time_schedule" TEXT;
ALTER TABLE "events" ADD COLUMN "practice_venue" TEXT;
