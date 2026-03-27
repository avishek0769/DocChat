/*
  Warnings:

  - You are about to drop the column `hashed_key` on the `ApiKey` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[encrypted_key]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `encrypted_key` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iv` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tag` to the `ApiKey` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `provider` on the `ApiKey` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Providers" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE', 'XAI', 'OPENROUTER');

-- DropIndex
DROP INDEX "ApiKey_hashed_key_key";

-- AlterTable
ALTER TABLE "ApiKey" DROP COLUMN "hashed_key",
ADD COLUMN     "encrypted_key" TEXT NOT NULL,
ADD COLUMN     "iv" TEXT NOT NULL,
ADD COLUMN     "tag" TEXT NOT NULL,
DROP COLUMN "provider",
ADD COLUMN     "provider" "Providers" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_encrypted_key_key" ON "ApiKey"("encrypted_key");
