"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import type { ExpenseCategory } from "@/lib/accounting-api";
import { settingsKeys } from "@/lib/query-keys";
import { settingsPageTitle } from "@/lib/settings-nav";
import { SettingsPageShell } from "../_components/SettingsPageShell";
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

  return (
    <SettingsPageShell title={settingsPageTitle("/expense-categories")} loading={loading}>
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
    </SettingsPageShell>
  );
}
