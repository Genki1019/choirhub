import { Check, X, Loader2 } from "lucide-react";
import type { VisitorApplication } from "@/lib/api-types";

interface ApplicationRowProps {
  application: VisitorApplication;
  selected: boolean;
  processing: boolean;
  disabled: boolean;
  onToggleSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ApplicationRow({
  application: a,
  selected,
  processing,
  disabled,
  onToggleSelect,
  onApprove,
  onReject,
}: ApplicationRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(a.id)}
        className="accent-brand-600 mt-1 h-4 w-4 rounded"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-800">{a.name}</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
            {a.source === "google_form" ? "Googleフォーム" : "手入力"}
          </span>
        </div>
        <div className="mt-1 space-y-0.5 text-xs text-gray-500">
          {a.partHope && <p>希望パート: {a.partHope}</p>}
          {a.originGroup && <p>出身団体: {a.originGroup}</p>}
          {a.contact && <p>連絡先: {a.contact}</p>}
          {a.message && <p>コメント: {a.message}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => onApprove(a.id)}
          disabled={disabled}
          aria-label="承認"
          className="flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
        >
          {processing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          承認
        </button>
        <button
          onClick={() => onReject(a.id)}
          disabled={disabled}
          aria-label="却下"
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          <X size={13} />
          却下
        </button>
      </div>
    </div>
  );
}
