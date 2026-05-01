-- CreateTable
CREATE TABLE "DocumentTree" (
    "id" TEXT NOT NULL,
    "chat_source_id" TEXT NOT NULL,
    "source_data" TEXT NOT NULL,
    "tree_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTree_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTree_id_key" ON "DocumentTree"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTree_chat_source_id_key" ON "DocumentTree"("chat_source_id");

-- AddForeignKey
ALTER TABLE "DocumentTree" ADD CONSTRAINT "DocumentTree_chat_source_id_fkey" FOREIGN KEY ("chat_source_id") REFERENCES "ChatSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
