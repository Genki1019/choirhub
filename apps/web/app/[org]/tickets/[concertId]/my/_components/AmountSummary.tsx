function yen(amount: number) {
  return `¥${amount.toLocaleString()}`;
}

interface AmountSummaryProps {
  allocatedCount: number;
  soldAdult: number;
  soldStudent: number;
  returnedCount: number;
  price: number;
  priceStudent: number | null;
}

export function AmountSummary({
  allocatedCount,
  soldAdult,
  soldStudent,
  returnedCount,
  price,
  priceStudent,
}: AmountSummaryProps) {
  const effectiveStudentPrice = priceStudent ?? price;
  const soldTotal = soldAdult + soldStudent;
  const soldAmount = soldAdult * price + soldStudent * effectiveStudentPrice;
  const remaining = allocatedCount - soldTotal - returnedCount;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-gray-50 px-2 py-3">
        <p className="text-xs text-gray-400">預かり</p>
        <p className="mt-0.5 text-lg font-bold text-gray-800">{allocatedCount}枚</p>
      </div>
      <div className="rounded-xl bg-gray-50 px-2 py-3">
        <p className="text-xs text-gray-400">販売済み</p>
        <p className="text-brand-600 mt-0.5 text-lg font-bold">{soldTotal}枚</p>
        <p className="text-brand-600 mt-0.5 text-xs">{yen(soldAmount)}</p>
      </div>
      <div className="rounded-xl bg-gray-50 px-2 py-3">
        <p className="text-xs text-gray-400">手元残</p>
        <p
          className={`mt-0.5 text-lg font-bold ${remaining < 0 ? "text-red-500" : "text-amber-600"}`}
        >
          {remaining}枚
        </p>
      </div>
    </div>
  );
}
