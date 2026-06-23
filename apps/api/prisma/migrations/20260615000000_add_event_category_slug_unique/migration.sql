-- AddUniqueIndex: event_categories(org_id, slug)
-- NULL は PostgreSQL の UNIQUE インデックスでは別値扱いのため、複数 NULL は許容される
CREATE UNIQUE INDEX "event_categories_org_id_slug_key" ON "event_categories"("org_id", "slug");
