"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { eventKeys } from "@/lib/query-keys";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { CategoryList } from "./_components/CategoryList";
import { AddCategoryForm } from "./_components/AddCategoryForm";

export default function EventCategoriesPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: categories = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: eventKeys.categories(org),
    queryFn:  () => settingsApi.listEventCategories(org),
  });

  const displayError = queryError?.message ?? mutationError;

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center py-4">
          <h1 className="text-lg font-semibold text-gray-800">イベント区分</h1>
        </PageBleedRow>
      </header>

      <PageMain>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : (
          <div className="max-w-lg space-y-6">
            <p className="text-xs text-gray-400">練習・本番などのシステム標準区分は削除できません。名前・色の変更は可能です。</p>

            {displayError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                <AlertCircle size={14} className="shrink-0" />
                {displayError}
              </div>
            )}

            <CategoryList
              categories={categories}
              org={org}
              onUpdated={(updated) => queryClient.setQueryData<EventCategory[]>(eventKeys.categories(org), (prev) =>
                prev ? prev.map((c) => c.id === updated.id ? updated : c) : prev
              )}
              onDeleted={(id) => queryClient.setQueryData<EventCategory[]>(eventKeys.categories(org), (prev) =>
                prev ? prev.filter((c) => c.id !== id) : prev
              )}
              onReordered={(reordered) => queryClient.setQueryData(eventKeys.categories(org), reordered)}
              onError={setMutationError}
            />

            <AddCategoryForm
              org={org}
              onCreated={(cat) => queryClient.setQueryData<EventCategory[]>(eventKeys.categories(org), (prev) =>
                prev ? [...prev, cat] : prev
              )}
            />

            <p className="text-xs text-gray-400">↑↓ で表示順を変更できます。</p>
          </div>
        )}
      </PageMain>
    </div>
  );
}
