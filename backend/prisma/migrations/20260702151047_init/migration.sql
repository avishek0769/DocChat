-- AlterTable
ALTER TABLE "ChatSource" ADD COLUMN     "last_indexed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DocumentPage" ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_fetched_at" TIMESTAMP(3);
