-- DropForeignKey
ALTER TABLE "UsageEvents" DROP CONSTRAINT "UsageEvents_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "UsageEvents" DROP CONSTRAINT "UsageEvents_message_id_fkey";

-- AlterTable
ALTER TABLE "UsageEvents" ALTER COLUMN "message_id" DROP NOT NULL,
ALTER COLUMN "chat_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "UsageEvents" ADD CONSTRAINT "UsageEvents_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvents" ADD CONSTRAINT "UsageEvents_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
