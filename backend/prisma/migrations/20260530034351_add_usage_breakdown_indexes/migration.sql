-- CreateIndex
CREATE INDEX "UsageEvents_user_id_timestamp_idx" ON "UsageEvents"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "UsageEvents_message_id_idx" ON "UsageEvents"("message_id");

-- CreateIndex
CREATE INDEX "UsageEvents_apikey_id_idx" ON "UsageEvents"("apikey_id");
