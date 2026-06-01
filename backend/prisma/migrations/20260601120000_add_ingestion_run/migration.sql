-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "chat_source_id" TEXT NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'STARTED',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionRun_id_key" ON "IngestionRun"("id");

-- CreateIndex
CREATE INDEX "IngestionRun_chat_id_started_at_idx" ON "IngestionRun"("chat_id", "started_at");

-- CreateIndex
CREATE INDEX "IngestionRun_chat_source_id_started_at_idx" ON "IngestionRun"("chat_source_id", "started_at");

-- CreateIndex
CREATE INDEX "IngestionRun_status_started_at_idx" ON "IngestionRun"("status", "started_at");

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_chat_source_id_fkey" FOREIGN KEY ("chat_source_id") REFERENCES "ChatSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

