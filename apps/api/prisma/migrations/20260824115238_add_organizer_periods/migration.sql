/*
  Warnings:

  - You are about to drop the column `monthly_organizer` on the `organizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "monthly_organizer";

-- CreateTable
CREATE TABLE "organizer_periods" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "from_month" TEXT NOT NULL,
    "to_month" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizer_periods_org_id_part_id_key" ON "organizer_periods"("org_id", "part_id");

-- AddForeignKey
ALTER TABLE "organizer_periods" ADD CONSTRAINT "organizer_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_periods" ADD CONSTRAINT "organizer_periods_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
