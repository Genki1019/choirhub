"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { memberKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { PageWithHeader } from "@/components/PageWithHeader";
import { PartCard } from "./_components/PartCard";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

export default function PartsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    select: (data) => [...data].sort((a, b) => a.sortOrder - b.sortOrder),
  });
  const parts = data ?? [];

  return (
    <PageWithHeader
      title={settingsPageTitle("/parts")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      {error && !data ? (
        <ErrorMessage variant="section" autoScroll={false}>
          {userErrorMessage(
            error,
            "パートの読み込みに失敗しました。ページを再読み込みしてください。",
          )}
        </ErrorMessage>
      ) : (
        <>
          <PartCard
            parts={parts}
            org={org}
            canEdit={roles.includes("admin")}
            onUpdated={(updated) =>
              queryClient.setQueryData<PartSummary[]>(memberKeys.parts(org), (prev) =>
                prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
              )
            }
            onDeleted={(id) =>
              queryClient.setQueryData<PartSummary[]>(memberKeys.parts(org), (prev) =>
                prev ? prev.filter((p) => p.id !== id) : prev,
              )
            }
            onCreated={(created) =>
              queryClient.setQueryData<PartSummary[]>(memberKeys.parts(org), (prev) =>
                prev ? [...prev, created] : prev,
              )
            }
            onReordered={(reordered) => queryClient.setQueryData(memberKeys.parts(org), reordered)}
          />

          {roles.includes("admin") && (
            <p className="text-xs text-gray-400">
              ドラッグして表示順を変更できます。在団メンバーが所属しているパートは削除できません。
            </p>
          )}
        </>
      )}
    </PageWithHeader>
  );
}
