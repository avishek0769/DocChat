/*
  Warnings:

  - The `total_pages` column on the `ChatSource` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ChatSource" DROP COLUMN "total_pages",
ADD COLUMN     "total_pages" INTEGER;
