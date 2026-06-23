export function DangerZone() {
  return (
    <div className="bg-white rounded-xl border border-red-100 px-6 py-5">
      <h2 className="text-sm font-semibold text-red-500 mb-3">危険な操作</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-700">この団体を削除する</p>
          <p className="text-xs text-gray-400 mt-0.5">削除すると元に戻すことはできません。全データが失われます。</p>
        </div>
        <button
          type="button"
          disabled
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg opacity-40 cursor-not-allowed"
        >
          削除
        </button>
      </div>
    </div>
  );
}
