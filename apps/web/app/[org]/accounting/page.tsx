"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, AlertCircle, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountingApi } from "@/lib/accounting-api";
import type { ExpenseItem } from "@/lib/accounting-api";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { accountingKeys, memberKeys, settingsKeys } from "@/lib/query-keys";
import { ExpenseModal } from "./_components/ExpenseModal";
import { CollectionModal } from "./_components/CollectionModal";
import { CollectionsTab } from "./_components/CollectionsTab";
import { ExpensesTab } from "./_components/ExpensesTab";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useToast } from "@/hooks/useToast";

function yen(n: number) {
  return `¥${n.toLocaleString()}`;
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const abs = Math.abs(value);
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="mb-1 text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${color}`}>
        {value < 0 ? "-" : ""}
        {yen(abs)}
      </p>
    </div>
  );
}

type Tab = "expenses" | "collections";

export default function AccountingPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState<Tab>("collections");

  const [expenseModal, setExpenseModal] = useState<{ open: boolean; editing: ExpenseItem | null }>({
    open: false,
    editing: null,
  });
  const [collectionModal, setCollectionModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const {
    data: summary,
    isLoading: loadingSummary,
    error: summaryError,
  } = useQuery({
    queryKey: accountingKeys.summary(org, year),
    queryFn: () => accountingApi.summary(org, year),
  });
  const {
    data: expenses = [],
    isLoading: loadingExpenses,
    error: expensesError,
  } = useQuery({
    queryKey: accountingKeys.expenses(org, year),
    queryFn: () =>
      accountingApi.listExpenses(org, {
        from: `${year}-01-01T00:00:00.000Z`,
        to: `${year}-12-31T23:59:59.999Z`,
      }),
  });
  const {
    data: collections = [],
    isLoading: loadingCollections,
    error: collectionsError,
  } = useQuery({
    queryKey: accountingKeys.collections(org, year),
    queryFn: () =>
      accountingApi.listCollections(org, {
        from: `${year}-01-01T00:00:00.000Z`,
        to: `${year}-12-31T23:59:59.999Z`,
      }),
  });
  const { data: categories = [] } = useQuery({
    queryKey: settingsKeys.expenseCategories(org),
    queryFn: () => settingsApi.listExpenseCategories(org),
    enabled: expenseModal.open,
  });
  const { data: memberTypes = [] } = useQuery({
    queryKey: memberKeys.types(org),
    queryFn: () => settingsApi.listMemberTypes(org),
    enabled: collectionModal,
  });

  const loading = loadingSummary || loadingExpenses || loadingCollections;

  useEffect(() => {
    const is403 = (e: unknown) => e instanceof ApiClientError && e.status === 403;
    if (is403(summaryError) || is403(expensesError) || is403(collectionsError)) {
      router.replace(`/${org}`);
    }
  }, [summaryError, expensesError, collectionsError, org, router]);

  const handleExpenseSaved = (item: ExpenseItem, isNew: boolean) => {
    queryClient.setQueryData<ExpenseItem[]>(accountingKeys.expenses(org, year), (prev) =>
      prev ? (isNew ? [item, ...prev] : prev.map((e) => (e.id === item.id ? item : e))) : prev,
    );
    setExpenseModal({ open: false, editing: null });
    queryClient.invalidateQueries({ queryKey: accountingKeys.summary(org, year) });
  };

  const handleDeleteExpense = async (id: string) => {
    setDeletingId(id);
    try {
      await accountingApi.deleteExpense(org, id);
      queryClient.setQueryData<ExpenseItem[]>(accountingKeys.expenses(org, year), (prev) =>
        prev ? prev.filter((e) => e.id !== id) : prev,
      );
      queryClient.invalidateQueries({ queryKey: accountingKeys.summary(org, year) });
    } catch {
      showToast("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageWithHeader
        title="会計"
        loading={loading}
        mainClassName="space-y-5"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              aria-label="前の年度"
              className="p-1 text-gray-400 transition-colors hover:text-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="w-16 text-center text-sm font-medium text-gray-700">{year}年度</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              aria-label="次の年度"
              className="p-1 text-gray-400 transition-colors hover:text-gray-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      >
        {summaryError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
            <AlertCircle size={16} />
            <span className="text-sm">{summaryError.message}</span>
          </div>
        )}

        {!summaryError && summary && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="支出合計" value={summary.totalExpense} color="text-red-600" />
              <SummaryCard label="徴収済み" value={summary.totalCollected} color="text-teal-600" />
              <SummaryCard label="未回収" value={summary.totalPending} color="text-amber-600" />
              <SummaryCard
                label="残高"
                value={summary.balance}
                color={summary.balance >= 0 ? "text-brand-600" : "text-red-600"}
              />
            </div>

            {summary.expenseByCategory.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <p className="border-b border-gray-100 px-5 py-3 text-xs font-semibold text-gray-500">
                  カテゴリ別支出
                </p>
                <div className="divide-y divide-gray-100">
                  {summary.expenseByCategory.map((cat) => (
                    <div
                      key={cat.categoryId}
                      className="flex items-center justify-between px-5 py-2.5"
                    >
                      <span className="text-sm text-gray-700">{cat.name}</span>
                      <span className="text-sm font-medium text-gray-800">{yen(cat.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-0 border-b border-gray-200">
              {(
                [
                  ["collections", "徴収"],
                  ["expenses", "支出"],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={[
                    "border-b-2 px-5 py-2.5 text-sm font-medium transition-colors",
                    tab === key
                      ? "border-brand-500 text-brand-600"
                      : "border-transparent text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "collections" &&
              (collectionsError ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
                  <AlertCircle size={16} />
                  <span className="text-sm">{collectionsError.message}</span>
                </div>
              ) : (
                <CollectionsTab
                  collections={collections}
                  org={org}
                  onAddClick={() => setCollectionModal(true)}
                />
              ))}

            {tab === "expenses" &&
              (expensesError ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
                  <AlertCircle size={16} />
                  <span className="text-sm">{expensesError.message}</span>
                </div>
              ) : (
                <ExpensesTab
                  expenses={expenses}
                  deletingId={deletingId}
                  onAddClick={() => setExpenseModal({ open: true, editing: null })}
                  onEditClick={(exp) => setExpenseModal({ open: true, editing: exp })}
                  onDeleteClick={handleDeleteExpense}
                />
              ))}
          </>
        )}
      </PageWithHeader>

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
          onSaved={() => {
            setCollectionModal(false);
            queryClient.invalidateQueries({ queryKey: accountingKeys.all(org) });
          }}
        />
      )}

      {toast && (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-white shadow-lg">
          <Check size={13} className="text-teal-400" />
          {toast}
        </div>
      )}
    </>
  );
}
