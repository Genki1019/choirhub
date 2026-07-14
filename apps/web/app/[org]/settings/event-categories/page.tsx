"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { eventKeys } from "@/lib/query-keys";
import { settingsPageTitle } from "@/lib/settings-nav";
import { SettingsPageShell } from "../_components/SettingsPageShell";
import { CategoryList } from "./_components/CategoryList";
import { AddCategoryForm } from "./_components/AddCategoryForm";

export default function EventCategoriesPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const {
    data: categories = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: eventKeys.categories(org),
    queryFn: () => settingsApi.listEventCategories(org),
  });

  const displayError = queryError?.message ?? mutationError;

  return (
    <SettingsPageShell title={settingsPageTitle("/event-categories")} loading={loading}>
      <p className="text-xs text-gray-400">
        練習・本番などのシステム標準区分は削除できません。名前・色の変更は可能です。
      </p>

      {displayError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={14} className="shrink-0" />
          {displayError}
        </div>
      )}

      <CategoryList
        categories={categories}
        org={org}
        onUpdated={(updated) =>
          queryClient.setQueryData<EventCategory[]>(eventKeys.categories(org), (prev) =>
            prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev,
          )
        }
        onDeleted={(id) =>
          queryClient.setQueryData<EventCategory[]>(eventKeys.categories(org), (prev) =>
            prev ? prev.filter((c) => c.id !== id) : prev,
          )
        }
        onReordered={(reordered) => queryClient.setQueryData(eventKeys.categories(org), reordered)}
        onError={setMutationError}
      />

      <AddCategoryForm
        org={org}
        onCreated={(cat) =>
          queryClient.setQueryData<EventCategory[]>(eventKeys.categories(org), (prev) =>
            prev ? [...prev, cat] : prev,
          )
        }
      />

      <p className="text-xs text-gray-400">↑↓ で表示順を変更できます。</p>
    </SettingsPageShell>
  );
}
