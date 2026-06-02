CREATE INDEX "Chat_user_id_created_at_idx" ON "Chat"("user_id", "created_at");
CREATE INDEX "Chat_status_created_at_idx" ON "Chat"("status", "created_at");
CREATE INDEX "ChatMessage_chat_id_created_at_idx" ON "ChatMessage"("chat_id", "created_at");
CREATE INDEX "UsageEvents_user_id_timestamp_idx" ON "UsageEvents"("user_id", "timestamp");
