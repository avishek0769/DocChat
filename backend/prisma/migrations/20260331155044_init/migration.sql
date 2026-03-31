/*
  Warnings:

  - Made the column `chat_id` on table `UsageEvents` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "UsageEvents" DROP CONSTRAINT "UsageEvents_chat_id_fkey";

-- AlterTable
ALTER TABLE "UsageEvents" ALTER COLUMN "chat_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "UsageEvents" ADD CONSTRAINT "UsageEvents_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
