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
  allocatedCount, soldAdult, soldStudent, returnedCount, price, priceStudent,
}: AmountSummaryProps) {
  const effectiveStudentPrice = priceStudent ?? price;
  const soldTotal  = soldAdult + soldStudent;
  const soldAmount = soldAdult * price + soldStudent * effectiveStudentPrice;
  const remaining  = allocatedCount - soldTotal - returnedCount;

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="bg-gray-50 rounded-xl py-3 px-2">
        <p className="text-xs text-gray-400">預かり</p>
        <p className="text-lg font-bold mt-0.5 text-gray-800">{allocatedCount}枚</p>
      </div>
      <div className="bg-gray-50 rounded-xl py-3 px-2">
        <p className="text-xs text-gray-400">販売済み</p>
        <p className="text-lg font-bold mt-0.5 text-blue-600">{soldTotal}枚</p>
        <p className="text-xs mt-0.5 text-blue-600">{yen(soldAmount)}</p>
      </div>
      <div className="bg-gray-50 rounded-xl py-3 px-2">
        <p className="text-xs text-gray-400">手元残</p>
        <p className={`text-lg font-bold mt-0.5 ${remaining < 0 ? "text-red-500" : "text-amber-600"}`}>{remaining}枚</p>
      </div>
    </div>
  );
}
