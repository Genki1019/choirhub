interface MonthlyOrganizerCardProps {
  organizer: string | null;
}

export function MonthlyOrganizerCard({ organizer }: MonthlyOrganizerCardProps) {
  return (
    <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-xs font-medium text-gray-400">今月の幹事</p>
      <p className={`mt-1 text-2xl font-bold ${organizer ? "text-brand-500" : "text-gray-300"}`}>
        {organizer ?? "未設定"}
      </p>
      <p className="mt-1 text-xs text-gray-400">飲み会幹事パート</p>
    </div>
  );
}
