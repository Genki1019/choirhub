-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'offstage', 'alumni', 'suspended');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('attending', 'absent', 'maybe', 'undecided');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('secret', 'restricted', 'public');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('full_score', 'part_score', 'midi', 'audio', 'other');

-- CreateEnum
CREATE TYPE "ConcertStatus" AS ENUM ('draft', 'survey_open', 'confirmed', 'past');

-- CreateEnum
CREATE TYPE "OnStageStatus" AS ENUM ('on', 'off', 'undecided');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('per_rehearsal', 'monthly');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'paypay', 'bank_transfer', 'other');

-- CreateEnum
CREATE TYPE "CollectionPaymentStatus" AS ENUM ('pending', 'paid', 'waived');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name_ja" TEXT NOT NULL,
    "name_en" TEXT,
    "name_kana" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "part_template" JSONB NOT NULL,
    "role_names" JSONB,
    "monthly_organizer" TEXT,
    "fee_type" "FeeType" NOT NULL DEFAULT 'per_rehearsal',
    "default_fee_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "voice_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "part_id" TEXT,
    "member_type_id" TEXT,
    "roles" TEXT[] DEFAULT ARRAY['member']::TEXT[],
    "status" "MemberStatus" NOT NULL DEFAULT 'active',
    "bio" TEXT,
    "job" TEXT,
    "interests" TEXT,
    "origin_group" TEXT,
    "joined_at" DATE,
    "phone" TEXT,
    "admin_memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "location_url" TEXT,
    "deadline" TIMESTAMP(3),
    "page_memo" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "target_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_part_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "concert_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'undecided',
    "arrive_time" TEXT,
    "leave_time" TEXT,
    "day_memo" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "composer" TEXT,
    "arranger" TEXT,
    "is_commissioned" BOOLEAN NOT NULL DEFAULT false,
    "access_level" "AccessLevel" NOT NULL DEFAULT 'restricted',
    "purchase_date" DATE,
    "distribution_start" DATE,
    "purchase_price" INTEGER,
    "distribution_price" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_files" (
    "id" TEXT NOT NULL,
    "score_id" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "part_id" TEXT,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "access_level" "AccessLevel",
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_access_logs" (
    "id" TEXT NOT NULL,
    "score_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concerts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "held_on" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "status" "ConcertStatus" NOT NULL DEFAULT 'draft',
    "race_published_at" TIMESTAMP(3),
    "ticket_input_closed_at" TIMESTAMP(3),
    "outreach_expense_per_trip" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "concert_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "score_id" TEXT,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concert_surveys" (
    "id" TEXT NOT NULL,
    "concert_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "open_at" TIMESTAMP(3) NOT NULL,
    "close_at" TIMESTAMP(3),
    "is_open" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "concert_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'undecided',
    "memo" TEXT,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "on_stage_assignments" (
    "id" TEXT NOT NULL,
    "concert_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "program_id" TEXT,
    "status" "OnStageStatus" NOT NULL DEFAULT 'undecided',
    "sort_order" INTEGER,

    CONSTRAINT "on_stage_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_activities" (
    "id" TEXT NOT NULL,
    "concert_id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "activity_date" DATE NOT NULL,
    "note" TEXT,
    "status" "OutreachStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_participants" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "tickets_sold" INTEGER NOT NULL DEFAULT 0,
    "expense" INTEGER,

    CONSTRAINT "outreach_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sent_by_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" TEXT NOT NULL DEFAULT '',
    "body_preview" TEXT NOT NULL DEFAULT '',
    "resend_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipient_member_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "mail_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_batches" (
    "id" TEXT NOT NULL,
    "concert_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "price_student" INTEGER,
    "total_count" INTEGER NOT NULL,
    "sale_start" TIMESTAMP(3),
    "sale_end" TIMESTAMP(3),
    "race_published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_allocations" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "allocated_count" INTEGER NOT NULL DEFAULT 0,
    "requested_count" INTEGER,
    "sold_adult" INTEGER NOT NULL DEFAULT 0,
    "sold_student" INTEGER NOT NULL DEFAULT 0,
    "sold_other" INTEGER NOT NULL DEFAULT 0,
    "returned_count" INTEGER NOT NULL DEFAULT 0,
    "outreach_count" INTEGER NOT NULL DEFAULT 0,
    "is_outreach_expense_paid" BOOLEAN NOT NULL DEFAULT false,
    "outreach_expense_paid_at" TIMESTAMP(3),
    "is_collected" BOOLEAN NOT NULL DEFAULT false,
    "reported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name_ja" TEXT,
    "org_id" TEXT NOT NULL,
    "roles" TEXT[],
    "part_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_types" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_fee_amount" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_method" "PaymentMethod",
    "paid_at" DATE,
    "event_id" TEXT,
    "note" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due_date" DATE,
    "event_id" TEXT,
    "year_month" TEXT,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_payments" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "status" "CollectionPaymentStatus" NOT NULL DEFAULT 'pending',
    "amount" INTEGER,
    "paid_at" DATE,
    "method" "PaymentMethod",
    "note" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_purchases" (
    "id" TEXT NOT NULL,
    "score_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "amount" INTEGER,
    "purchased_at" DATE,
    "note" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "members_user_id_idx" ON "members"("user_id");

-- CreateIndex
CREATE INDEX "members_org_id_idx" ON "members"("org_id");

-- CreateIndex
CREATE INDEX "members_org_id_part_id_idx" ON "members"("org_id", "part_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_user_id_org_id_key" ON "members"("user_id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_org_id_name_key" ON "event_categories"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "events_concert_id_key" ON "events"("concert_id");

-- CreateIndex
CREATE INDEX "events_org_id_starts_at_idx" ON "events"("org_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_event_id_member_id_key" ON "attendances"("event_id", "member_id");

-- CreateIndex
CREATE INDEX "scores_org_id_access_level_idx" ON "scores"("org_id", "access_level");

-- CreateIndex
CREATE INDEX "score_files_score_id_idx" ON "score_files"("score_id");

-- CreateIndex
CREATE INDEX "score_access_logs_score_id_created_at_idx" ON "score_access_logs"("score_id", "created_at");

-- CreateIndex
CREATE INDEX "concerts_org_id_held_on_idx" ON "concerts"("org_id", "held_on");

-- CreateIndex
CREATE INDEX "programs_stage_id_sort_order_idx" ON "programs"("stage_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_survey_id_member_id_stage_id_key" ON "survey_responses"("survey_id", "member_id", "stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "on_stage_assignments_concert_id_member_id_program_id_key" ON "on_stage_assignments"("concert_id", "member_id", "program_id");

-- CreateIndex
CREATE INDEX "outreach_activities_concert_id_idx" ON "outreach_activities"("concert_id");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_participants_activity_id_member_id_key" ON "outreach_participants"("activity_id", "member_id");

-- CreateIndex
CREATE INDEX "mail_templates_org_id_idx" ON "mail_templates"("org_id");

-- CreateIndex
CREATE INDEX "mail_logs_org_id_sent_at_idx" ON "mail_logs"("org_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_allocations_batch_id_member_id_key" ON "ticket_allocations"("batch_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokens_token_key" ON "invite_tokens"("token");

-- CreateIndex
CREATE INDEX "invite_tokens_token_idx" ON "invite_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_org_id_name_key" ON "expense_categories"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "member_types_org_id_name_key" ON "member_types"("org_id", "name");

-- CreateIndex
CREATE INDEX "expenses_org_id_paid_at_idx" ON "expenses"("org_id", "paid_at");

-- CreateIndex
CREATE INDEX "collections_org_id_idx" ON "collections"("org_id");

-- CreateIndex
CREATE INDEX "collections_org_id_year_month_idx" ON "collections"("org_id", "year_month");

-- CreateIndex
CREATE INDEX "collection_payments_collection_id_idx" ON "collection_payments"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_payments_collection_id_member_id_key" ON "collection_payments"("collection_id", "member_id");

-- CreateIndex
CREATE INDEX "score_purchases_score_id_idx" ON "score_purchases"("score_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_purchases_score_id_member_id_key" ON "score_purchases"("score_id", "member_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_member_type_id_fkey" FOREIGN KEY ("member_type_id") REFERENCES "member_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_files" ADD CONSTRAINT "score_files_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_access_logs" ADD CONSTRAINT "score_access_logs_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_access_logs" ADD CONSTRAINT "score_access_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concerts" ADD CONSTRAINT "concerts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concert_surveys" ADD CONSTRAINT "concert_surveys_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "concert_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "on_stage_assignments" ADD CONSTRAINT "on_stage_assignments_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "on_stage_assignments" ADD CONSTRAINT "on_stage_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "on_stage_assignments" ADD CONSTRAINT "on_stage_assignments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_activities" ADD CONSTRAINT "outreach_activities_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_activities" ADD CONSTRAINT "outreach_activities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_participants" ADD CONSTRAINT "outreach_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "outreach_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_participants" ADD CONSTRAINT "outreach_participants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_templates" ADD CONSTRAINT "mail_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_templates" ADD CONSTRAINT "mail_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_logs" ADD CONSTRAINT "mail_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_logs" ADD CONSTRAINT "mail_logs_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_batches" ADD CONSTRAINT "ticket_batches_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_allocations" ADD CONSTRAINT "ticket_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ticket_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_allocations" ADD CONSTRAINT "ticket_allocations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_types" ADD CONSTRAINT "member_types_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_payments" ADD CONSTRAINT "collection_payments_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_payments" ADD CONSTRAINT "collection_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_payments" ADD CONSTRAINT "collection_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_purchases" ADD CONSTRAINT "score_purchases_score_id_fkey" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_purchases" ADD CONSTRAINT "score_purchases_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_purchases" ADD CONSTRAINT "score_purchases_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
