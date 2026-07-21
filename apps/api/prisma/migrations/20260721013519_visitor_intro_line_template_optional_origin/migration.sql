-- AlterTable
-- 新規団体のデフォルト値のみ変更。既存団体が保存済みの値は変更しない。
ALTER TABLE "organizations" ALTER COLUMN "visitor_intro_line_template" SET DEFAULT '・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）';
