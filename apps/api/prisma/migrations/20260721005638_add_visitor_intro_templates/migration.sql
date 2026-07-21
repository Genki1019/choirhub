-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "visitor_intro_subject_template" TEXT NOT NULL DEFAULT '見学者のご紹介';
ALTER TABLE "organizations" ADD COLUMN "visitor_intro_body_template" TEXT NOT NULL DEFAULT E'以下の方が見学にいらっしゃいます。\n\n{lines}';
ALTER TABLE "organizations" ADD COLUMN "visitor_intro_line_template" TEXT NOT NULL DEFAULT '・{name}さん（希望パート: {part} / 出身団体: {origin}）';
