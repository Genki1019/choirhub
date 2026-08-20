-- CreateEnum
CREATE TYPE "OrgApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "org_applications" (
    "id" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "applicant_name" TEXT NOT NULL,
    "applicant_email" TEXT NOT NULL,
    "message" TEXT,
    "status" "OrgApplicationStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_email" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_applications_status_idx" ON "org_applications"("status");
