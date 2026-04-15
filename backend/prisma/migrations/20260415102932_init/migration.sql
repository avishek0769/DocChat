-- AlterTable
ALTER TABLE "Chat" ALTER COLUMN "collection_name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChatSource" ADD COLUMN     "is_vector_less" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "collection_name" DROP NOT NULL;
