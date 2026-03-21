-- CreateIndex
CREATE INDEX "bookmark_user_created_idx" ON "Bookmark"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bookmark_user_enriched_idx" ON "Bookmark"("userId", "enrichedAt");

-- CreateIndex
CREATE INDEX "tag_name_idx" ON "Tag"("name");
