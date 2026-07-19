"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import type { ExpenseCategory } from "@/lib/accounting-api";
import { settingsKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useToast } from "@/hooks/useToast";
import { ExpenseCategoryCard } from "./_components/ExpenseCategoryCard";

export default function ExpenseCategoriesPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();

  const { data: cats = [], isLoading: loading } = useQuery({
    queryKey: settingsKeys.expenseCategories(org),
    queryFn: () => settingsApi.listExpenseCategories(org),
  });

  return (
    <PageWithHeader
      title={settingsPageTitle("/expense-categories")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

      <ExpenseCategoryCard
        cats={cats}
        org={org}
        onUpdated={(updated) =>
          queryClient.setQueryData<ExpenseCategory[]>(
            settingsKeys.expenseCategories(org),
            (prev) => (prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev),
          )
        }
        onDeleted={(id) =>
          queryClient.setQueryData<ExpenseCategory[]>(
            settingsKeys.expenseCategories(org),
            (prev) => (prev ? prev.filter((c) => c.id !== id) : prev),
          )
        }
        onCreated={(created) =>
          queryClient.setQueryData<ExpenseCategory[]>(
            settingsKeys.expenseCategories(org),
            (prev) => (prev ? [...prev, created] : prev),
          )
        }
        onToast={showToast}
      />

      <p className="text-xs text-gray-400">支出記録が紐付いているカテゴリは削除できません。</p>
    </PageWithHeader>
  );
}
