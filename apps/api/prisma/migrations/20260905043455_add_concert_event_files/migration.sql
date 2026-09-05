-- CreateTable
CREATE TABLE "event_files" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concert_files" (
    "id" TEXT NOT NULL,
    "concert_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concert_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_files_event_id_idx" ON "event_files"("event_id");

-- CreateIndex
CREATE INDEX "concert_files_concert_id_idx" ON "concert_files"("concert_id");

-- AddForeignKey
ALTER TABLE "event_files" ADD CONSTRAINT "event_files_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concert_files" ADD CONSTRAINT "concert_files_concert_id_fkey" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
