-- CreateEnum
CREATE TYPE "PianoPosition" AS ENUM ('center', 'kamite');

-- CreateEnum
CREATE TYPE "FormationBoxKind" AS ENUM ('conductor', 'piano', 'custom');

-- DropForeignKey
ALTER TABLE "on_stage_assignments" DROP CONSTRAINT "on_stage_assignments_program_id_fkey";

-- DropIndex
DROP INDEX "on_stage_assignments_concert_id_member_id_program_id_key";

-- AlterTable
ALTER TABLE "concerts" ADD COLUMN     "applied_survey_id" TEXT;

-- AlterTable
ALTER TABLE "on_stage_assignments" DROP COLUMN "program_id",
DROP COLUMN "sort_order",
ADD COLUMN     "stage_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "formation_patterns" (
    "id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_staggered" BOOLEAN NOT NULL DEFAULT false,
    "piano_position" "PianoPosition" NOT NULL DEFAULT 'center',

    CONSTRAINT "formation_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formation_boxes" (
    "id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "kind" "FormationBoxKind" NOT NULL,
    "title" TEXT,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "formation_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formation_slots" (
    "id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "member_id" TEXT,
    "label" TEXT,
    "box_id" TEXT,
    "row_num" INTEGER,
    "position_order" INTEGER NOT NULL,

    CONSTRAINT "formation_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "formation_patterns_stage_id_sort_order_idx" ON "formation_patterns"("stage_id", "sort_order");

-- CreateIndex
CREATE INDEX "formation_boxes_pattern_id_sort_order_idx" ON "formation_boxes"("pattern_id", "sort_order");

-- CreateIndex
CREATE INDEX "formation_slots_pattern_id_idx" ON "formation_slots"("pattern_id");

-- CreateIndex
CREATE INDEX "formation_slots_box_id_idx" ON "formation_slots"("box_id");

-- CreateIndex
CREATE UNIQUE INDEX "on_stage_assignments_concert_id_member_id_stage_id_key" ON "on_stage_assignments"("concert_id", "member_id", "stage_id");

-- AddForeignKey
ALTER TABLE "concerts" ADD CONSTRAINT "concerts_applied_survey_id_fkey" FOREIGN KEY ("applied_survey_id") REFERENCES "concert_surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "on_stage_assignments" ADD CONSTRAINT "on_stage_assignments_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_patterns" ADD CONSTRAINT "formation_patterns_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_boxes" ADD CONSTRAINT "formation_boxes_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "formation_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_slots" ADD CONSTRAINT "formation_slots_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "formation_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_slots" ADD CONSTRAINT "formation_slots_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formation_slots" ADD CONSTRAINT "formation_slots_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "formation_boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

