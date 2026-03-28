/*
  Warnings:

  - Added the required column `collection_name` to the `Chat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "collection_name" TEXT NOT NULL;
