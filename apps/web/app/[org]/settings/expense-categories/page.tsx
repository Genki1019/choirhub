"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import type { ExpenseCategory } from "@/lib/accounting-api";
import { settingsKeys } from "@/lib/query-keys";
import { ExpenseCategoryCard } from "./_components/ExpenseCategoryCard";

export default function ExpenseCategoriesPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const { data: cats = [], isLoading: loading } = useQuery({
    queryKey: settingsKeys.expenseCategories(org),
    queryFn:  () => settingsApi.listExpenseCategories(org),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <ExpenseCategoryCard
        cats={cats}
        org={org}
        onUpdated={(updated) => queryClient.setQueryData<ExpenseCategory[]>(settingsKeys.expenseCategories(org), (prev) =>
          prev ? prev.map((c) => c.id === updated.id ? updated : c) : prev
        )}
        onDeleted={(id) => queryClient.setQueryData<ExpenseCategory[]>(settingsKeys.expenseCategories(org), (prev) =>
          prev ? prev.filter((c) => c.id !== id) : prev
        )}
        onCreated={(created) => queryClient.setQueryData<ExpenseCategory[]>(settingsKeys.expenseCategories(org), (prev) =>
          prev ? [...prev, created] : prev
        )}
        onToast={showToast}
      />

      <p className="text-xs text-gray-400">
        支出記録が紐付いているカテゴリは削除できません。
      </p>
    </div>
  );
}
