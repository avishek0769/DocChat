/*
  Warnings:

  - You are about to drop the column `chat_id` on the `ChatSource` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChatSource" DROP CONSTRAINT "ChatSource_chat_id_fkey";

-- AlterTable
ALTER TABLE "ChatSource" DROP COLUMN "chat_id";

-- CreateTable
CREATE TABLE "_ChatToChatSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ChatToChatSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ChatToChatSource_B_index" ON "_ChatToChatSource"("B");

-- AddForeignKey
ALTER TABLE "_ChatToChatSource" ADD CONSTRAINT "_ChatToChatSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatToChatSource" ADD CONSTRAINT "_ChatToChatSource_B_fkey" FOREIGN KEY ("B") REFERENCES "ChatSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
