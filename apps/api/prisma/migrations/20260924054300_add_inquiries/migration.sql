-- CreateEnum
CREATE TYPE "InquiryCategory" AS ENUM ('org_restore', 'account', 'privacy', 'bug_report', 'other');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('open', 'resolved');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "category" "InquiryCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "org_name" TEXT,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'open',
    "resolved_by_email" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_status_idx" ON "inquiries"("status");
