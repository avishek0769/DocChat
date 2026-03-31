-- DropForeignKey
ALTER TABLE "UsageEvents" DROP CONSTRAINT "UsageEvents_apikey_id_fkey";

-- AlterTable
ALTER TABLE "UsageEvents" ALTER COLUMN "apikey_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "UsageEvents" ADD CONSTRAINT "UsageEvents_apikey_id_fkey" FOREIGN KEY ("apikey_id") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
