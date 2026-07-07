-- AlterTable
ALTER TABLE "collections" ADD COLUMN "score_id" TEXT;

-- CreateIndex
CREATE INDEX "collections_score_id_idx" ON "collections"("score_id");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
