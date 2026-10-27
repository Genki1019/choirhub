"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import type { ExpenseCategory } from "@/lib/accounting-api";
import { settingsKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ExpenseCategoryCard } from "./_components/ExpenseCategoryCard";

export default function ExpenseCategoriesPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();

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
        onReordered={(reordered) =>
          queryClient.setQueryData(settingsKeys.expenseCategories(org), reordered)
        }
      />

      <p className="text-xs text-gray-400">支出記録が紐付いているカテゴリは削除できません。</p>
    </PageWithHeader>
  );
}
