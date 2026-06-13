-- AlterTable: add content_hash, last_fetched_at, is_active to DocumentPage
ALTER TABLE "DocumentPage"
    ADD COLUMN "content_hash" TEXT,
    ADD COLUMN "last_fetched_at" TIMESTAMP(3),
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex to efficiently look up stale (isActive=false) pages per chat source
CREATE INDEX "DocumentPage_chat_source_id_is_active_idx" ON "DocumentPage"("chat_source_id", "is_active");
