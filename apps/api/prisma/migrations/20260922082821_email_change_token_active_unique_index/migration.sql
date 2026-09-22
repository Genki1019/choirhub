-- ユーザーにつき未使用（usedAt IS NULL）の EmailChangeToken を1件までに制限する部分ユニークインデックス。
-- Prismaのスキーマ言語では部分インデックス（WHERE句付きUNIQUE）を表現できないため、
-- 手書きのSQLマイグレーションとして追加する（schema.prisma上には現れない）。
-- 同時に複数のメールアドレス変更申請が来た場合、2件目以降はこの制約違反(P2002)として
-- アプリケーション側（POST /members/me/email-change）で握りつぶし、列挙攻撃対策のため
-- 同一の成功レスポンスを返す。
CREATE UNIQUE INDEX "email_change_tokens_active_user_id_key" ON "email_change_tokens" ("user_id") WHERE "used_at" IS NULL;
