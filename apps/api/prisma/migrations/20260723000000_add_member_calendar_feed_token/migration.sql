-- AlterTable
ALTER TABLE "members" ADD COLUMN "calendar_feed_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "members_calendar_feed_token_key" ON "members"("calendar_feed_token");
