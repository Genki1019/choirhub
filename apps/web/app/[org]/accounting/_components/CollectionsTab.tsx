import Link from "next/link";
import { Wallet, Plus, ChevronRight } from "lucide-react";
import type { CollectionSummaryItem } from "@/lib/accounting-api";

function yen(n: number) {
  return `¥${n.toLocaleString()}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

interface CollectionsTabProps {
  collections: CollectionSummaryItem[];
  org: string;
  onAddClick: () => void;
}

export function CollectionsTab({ collections, org, onAddClick }: CollectionsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus size={14} />
          徴収を作成
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wallet size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">徴収が登録されていません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {collections.map((col) => {
              const { paid, pending, total, paidAmount } = col.summary;
              return (
                <Link
                  key={col.id}
                  href={`/${org}/accounting/collections/${col.id}`}
                  prefetch={false}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{col.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{yen(col.amount)}/人</span>
                      {col.yearMonth && <span>{col.yearMonth}</span>}
                      <span>{fmtDate(col.createdAt)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-teal-600">{yen(paidAmount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {paid}/{total}名
                      {pending > 0 && <span className="text-amber-500 ml-1">未{pending}</span>}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
