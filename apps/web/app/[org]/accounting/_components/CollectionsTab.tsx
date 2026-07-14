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
          className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          <Plus size={14} />
          徴収を作成
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Wallet size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">徴収が登録されていません</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="divide-y divide-gray-100">
            {collections.map((col) => {
              const { paid, pending, total, paidAmount } = col.summary;
              return (
                <Link
                  key={col.id}
                  href={`/${org}/accounting/collections/${col.id}`}
                  prefetch={false}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{col.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                      <span>{yen(col.amount)}/人</span>
                      {col.yearMonth && <span>{col.yearMonth}</span>}
                      <span>{fmtDate(col.createdAt)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-teal-600">{yen(paidAmount)}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {paid}/{total}名
                      {pending > 0 && <span className="ml-1 text-amber-500">未{pending}</span>}
                    </p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-gray-300" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
