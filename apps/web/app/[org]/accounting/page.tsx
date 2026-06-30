"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight, ChevronLeft,
  Loader2, AlertCircle, Check,
} from "lucide-react";
import { accountingApi } from "@/lib/accounting-api";
import type {
  FinanceSummary, ExpenseItem, CollectionSummaryItem,
  ExpenseCategory,
} from "@/lib/accounting-api";
import { settingsApi } from "@/lib/settings-api";
import type { MemberType } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { ExpenseModal } from "./_components/ExpenseModal";
import { CollectionModal } from "./_components/CollectionModal";
import { CollectionsTab } from "./_components/CollectionsTab";
import { ExpensesTab } from "./_components/ExpensesTab";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

function yen(n: number) {
  return `¥${n.toLocaleString()}`;
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const abs = Math.abs(value);
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value < 0 ? "-" : ""}{yen(abs)}</p>
    </div>
  );
}

type Tab = "expenses" | "collections";

export default function AccountingPage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const currentYear = new Date().getFullYear();
  const [year, setYear]       = useState(currentYear);
  const [tab,  setTab]        = useState<Tab>("collections");
  const [summary,     setSummary]     = useState<FinanceSummary | null>(null);
  const [expenses,    setExpenses]    = useState<ExpenseItem[]>([]);
  const [collections, setCollections] = useState<CollectionSummaryItem[]>([]);
  const [categories,  setCategories]  = useState<ExpenseCategory[]>([]);
  const [memberTypes, setMemberTypes] = useState<MemberType[]>([]);
  const [error,       setError]       = useState<string | null>(null);

  const [loadedFor,  setLoadedFor]  = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const loadKey = `${org}-${year}`;
  const loading = loadedFor !== loadKey;

  const [expenseModal,    setExpenseModal]    = useState<{ open: boolean; editing: ExpenseItem | null }>({ open: false, editing: null });
  const [collectionModal, setCollectionModal] = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [toast,           setToast]           = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    let cancelled = false;
    const key = `${org}-${year}`;
    const from = `${year}-01-01T00:00:00.000Z`;
    const to   = `${year}-12-31T23:59:59.999Z`;
    Promise.all([
      accountingApi.summary(org, year),
      accountingApi.listExpenses(org, { from, to }),
      accountingApi.listCollections(org, { from, to }),
      accountingApi.listCategories(org),
      settingsApi.listMemberTypes(org),
    ]).then(([sum, exp, col, cats, types]) => {
      if (cancelled) return;
      setSummary(sum);
      setExpenses(exp);
      setCollections(col);
      setCategories(cats);
      setMemberTypes(types);
      setError(null);
    }).catch((err) => {
      if (cancelled) return;
      if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
      if (err instanceof ApiClientError && err.status === 403) { router.replace(`/${org}`); return; }
      setError(err instanceof Error ? err.message : "データの取得に失敗しました");
    }).finally(() => { if (!cancelled) setLoadedFor(key); });
    return () => { cancelled = true; };
  }, [org, year, reloadTick, router]);

  const reload = () => {
    setLoadedFor(null);
    setReloadTick((t) => t + 1);
  };

  const handleExpenseSaved = (item: ExpenseItem, isNew: boolean) => {
    setExpenses((prev) =>
      isNew ? [item, ...prev] : prev.map((e) => e.id === item.id ? item : e)
    );
    setExpenseModal({ open: false, editing: null });
    accountingApi.summary(org, year).then(setSummary).catch(() => null);
  };

  const handleDeleteExpense = async (id: string) => {
    setDeletingId(id);
    try {
      await accountingApi.deleteExpense(org, id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      accountingApi.summary(org, year).then(setSummary).catch(() => null);
    } catch {
      showToast("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="shrink-0 bg-white border-b border-gray-200">
        <PageBleedRow className="flex items-center justify-between py-4">
          <h1 className="text-lg font-semibold text-gray-800">会計</h1>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label="前の年度" className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 w-16 text-center">{year}年度</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="次の年度" className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </PageBleedRow>
      </header>

      <PageMain className="space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard label="支出合計" value={summary.totalExpense}   color="text-red-600" />
              <SummaryCard label="徴収済み" value={summary.totalCollected} color="text-teal-600" />
              <SummaryCard label="未回収"   value={summary.totalPending}   color="text-amber-600" />
              <SummaryCard label="残高"     value={summary.balance}        color={summary.balance >= 0 ? "text-blue-600" : "text-red-600"} />
            </div>

            {summary.expenseByCategory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <p className="text-xs font-semibold text-gray-500 px-5 py-3 border-b border-gray-100">カテゴリ別支出</p>
                <div className="divide-y divide-gray-100">
                  {summary.expenseByCategory.map((cat) => (
                    <div key={cat.categoryId} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-sm text-gray-700">{cat.name}</span>
                      <span className="text-sm font-medium text-gray-800">{yen(cat.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-0 border-b border-gray-200">
              {([["collections", "徴収"], ["expenses", "支出"]] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={[
                    "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    tab === key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "collections" && (
              <CollectionsTab
                collections={collections}
                org={org}
                onAddClick={() => setCollectionModal(true)}
              />
            )}

            {tab === "expenses" && (
              <ExpensesTab
                expenses={expenses}
                deletingId={deletingId}
                onAddClick={() => setExpenseModal({ open: true, editing: null })}
                onEditClick={(exp) => setExpenseModal({ open: true, editing: exp })}
                onDeleteClick={handleDeleteExpense}
              />
            )}
          </>
        )}
      </PageMain>

      {expenseModal.open && (
        <ExpenseModal
          org={org}
          categories={categories}
          editing={expenseModal.editing}
          onClose={() => setExpenseModal({ open: false, editing: null })}
          onSaved={handleExpenseSaved}
        />
      )}

      {collectionModal && (
        <CollectionModal
          org={org}
          memberTypes={memberTypes}
          onClose={() => setCollectionModal(false)}
          onSaved={() => { setCollectionModal(false); reload(); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <Check size={13} className="text-teal-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
