export function StatCard({
  label, value, valueClass, sub,
}: {
  label: string;
  value: string;
  valueClass: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>
    </div>
  );
}
