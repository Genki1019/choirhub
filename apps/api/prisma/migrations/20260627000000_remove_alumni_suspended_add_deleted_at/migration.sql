-- alumni / suspended を active に変換
UPDATE "members" SET status = 'active' WHERE status IN ('alumni', 'suspended');

-- deleted_at カラムを追加
ALTER TABLE "members" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- 新しい enum を作成（PostgreSQL はenum値を直接削除できないため再作成）
CREATE TYPE "MemberStatus_new" AS ENUM ('active', 'offstage');
ALTER TABLE "members" ALTER COLUMN status DROP DEFAULT;
ALTER TABLE "members" ALTER COLUMN status TYPE "MemberStatus_new"
  USING (status::text::"MemberStatus_new");
ALTER TABLE "members" ALTER COLUMN status SET DEFAULT 'active'::"MemberStatus_new";
DROP TYPE "MemberStatus";
ALTER TYPE "MemberStatus_new" RENAME TO "MemberStatus";
