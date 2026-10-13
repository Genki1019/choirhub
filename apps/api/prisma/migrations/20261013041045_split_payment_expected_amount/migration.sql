-- AlterTable
ALTER TABLE "collection_payments" ADD COLUMN     "expected_amount" INTEGER;

UPDATE "collection_payments" AS cp
SET "expected_amount" = cp."amount"
FROM "collections" AS c, "members" AS m
LEFT JOIN "member_types" AS mt ON mt."id" = m."member_type_id"
WHERE c."id" = cp."collection_id"
  AND m."id" = cp."member_id"
  AND cp."amount" IS NOT NULL
  AND cp."amount" <> c."amount"
  AND (
    cp."status" <> 'paid'
    OR cp."amount" = mt."default_fee_amount"
    OR EXISTS (
      SELECT 1
      FROM "collection_payments" AS other
      JOIN "members" AS om ON om."id" = other."member_id"
      WHERE other."collection_id" = cp."collection_id"
        AND other."status" <> 'paid'
        AND other."amount" = cp."amount"
        AND om."member_type_id" = m."member_type_id"
    )
  );

UPDATE "collection_payments"
SET "amount" = NULL
WHERE "status" <> 'paid';
