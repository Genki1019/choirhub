-- CreateEnum
CREATE TYPE "VisitorApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "visitor_form_token" TEXT;

-- CreateTable
CREATE TABLE "visitor_applications" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "part_hope" TEXT,
    "origin_group" TEXT,
    "contact" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" "VisitorApplicationStatus" NOT NULL DEFAULT 'pending',
    "created_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_visitor_form_token_key" ON "organizations"("visitor_form_token");

-- CreateIndex
CREATE INDEX "visitor_applications_org_id_status_idx" ON "visitor_applications"("org_id", "status");

-- AddForeignKey
ALTER TABLE "visitor_applications" ADD CONSTRAINT "visitor_applications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_applications" ADD CONSTRAINT "visitor_applications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_applications" ADD CONSTRAINT "visitor_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
