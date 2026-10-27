"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { eventKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";
import { CategoryList } from "./_components/CategoryList";
import { AddCategoryForm } from "./_components/AddCategoryForm";

export default function EventCategoriesPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const canEdit = roles.includes("admin");
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: eventKeys.categories(org),
    queryFn: () => settingsApi.listEventCategories(org),
  });
  const categories = data ?? [];

  return (
    <PageWithHeader
      title={settingsPageTitle("/event-categories")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      <p className="text-xs text-gray-400">
        練習・本番などのシステム標準区分は削除できません。名前・色の変更は可能です。
      </p>

      {queryError && !data ? (
        <ErrorMessage variant="section" autoScroll={false}>
          {userErrorMessage(
            queryError,
            "区分の読み込みに失敗しました。ページを再読み込みしてください。",
          )}
        </ErrorMessage>
      ) : (
        <>
          <ErrorMessage>{mutationError}</ErrorMessage>

          <CategoryList
            categories={categories}
            org={org}
            canEdit={canEdit}
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
            onReordered={(reordered) =>
              queryClient.setQueryData(eventKeys.categories(org), reordered)
            }
            onError={setMutationError}
          />

          {canEdit && (
            <AddCategoryForm
              org={org}
              onCreated={(cat) =>
                queryClient.setQueryData<EventCategory[]>(eventKeys.categories(org), (prev) =>
                  prev ? [...prev, cat] : prev,
                )
              }
            />
          )}

          {canEdit && <p className="text-xs text-gray-400">ドラッグして表示順を変更できます。</p>}
        </>
      )}
    </PageWithHeader>
  );
}
