-- AlterTable
ALTER TABLE "UsageEvents" ADD COLUMN     "chat_id" TEXT;

-- AddForeignKey
ALTER TABLE "UsageEvents" ADD CONSTRAINT "UsageEvents_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
