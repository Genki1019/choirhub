export function DangerZone() {
  return (
    <div className="rounded-xl border border-red-100 bg-white px-6 py-5">
      <h2 className="mb-3 text-sm font-semibold text-red-500">危険な操作</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-700">この団体を削除する</p>
          <p className="mt-0.5 text-xs text-gray-400">
            削除すると元に戻すことはできません。全データが失われます。
          </p>
        </div>
        <button
          type="button"
          disabled
          className="shrink-0 cursor-not-allowed rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 opacity-40"
        >
          削除
        </button>
      </div>
    </div>
  );
}
