/*
  Warnings:

  - A unique constraint covering the columns `[share_token]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[documentation_url,is_vector_less]` on the table `ChatSource` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "share_token" TEXT;

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

-- CreateIndex
CREATE UNIQUE INDEX "Chat_share_token_key" ON "Chat"("share_token");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSource_documentation_url_is_vector_less_key" ON "ChatSource"("documentation_url", "is_vector_less");

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_chat_source_id_fkey" FOREIGN KEY ("chat_source_id") REFERENCES "ChatSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
