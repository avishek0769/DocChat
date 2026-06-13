-- DropForeignKey
ALTER TABLE "DocumentPage" DROP CONSTRAINT "DocumentPage_chat_source_id_fkey";

-- DropForeignKey
ALTER TABLE "DocumentTree" DROP CONSTRAINT "DocumentTree_chat_source_id_fkey";

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "failed_at" TIMESTAMP(3),
ADD COLUMN     "failure_reason" TEXT;

-- AlterTable
ALTER TABLE "ChatSource" ADD COLUMN     "scrape_limit" INTEGER;

-- AlterTable
ALTER TABLE "DocumentPage" ADD COLUMN     "end_index" INTEGER,
ADD COLUMN     "start_index" INTEGER;

-- AlterTable
ALTER TABLE "IngestionRun" ADD COLUMN     "pages_crawled" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pages_failed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UsageEvents" ADD COLUMN     "estimated_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
ADD COLUMN     "price_version" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" TEXT,
    "chat_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_id_key" ON "AuditEvent"("id");

-- CreateIndex
CREATE INDEX "AuditEvent_created_at_idx" ON "AuditEvent"("created_at");

-- CreateIndex
CREATE INDEX "AuditEvent_type_created_at_idx" ON "AuditEvent"("type", "created_at");

-- CreateIndex
CREATE INDEX "User_is_admin_created_at_idx" ON "User"("is_admin", "created_at");

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_chat_source_id_fkey" FOREIGN KEY ("chat_source_id") REFERENCES "ChatSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTree" ADD CONSTRAINT "DocumentTree_chat_source_id_fkey" FOREIGN KEY ("chat_source_id") REFERENCES "ChatSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
