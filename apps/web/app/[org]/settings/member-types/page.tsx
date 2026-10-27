"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import type { MemberType } from "@/lib/settings-api";
import { memberKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { PageWithHeader } from "@/components/PageWithHeader";
import { MemberTypeCard } from "./_components/MemberTypeCard";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

export default function MemberTypesPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: memberKeys.types(org),
    queryFn: () => settingsApi.listMemberTypes(org),
  });
  const types = data ?? [];

  return (
    <PageWithHeader
      title={settingsPageTitle("/member-types")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      {error && !data ? (
        <ErrorMessage variant="section" autoScroll={false}>
          {userErrorMessage(
            error,
            "メンバー区分の読み込みに失敗しました。ページを再読み込みしてください。",
          )}
        </ErrorMessage>
      ) : (
        <>
          <MemberTypeCard
            types={types}
            org={org}
            canEdit={roles.includes("admin")}
            onUpdated={(updated) =>
              queryClient.setQueryData<MemberType[]>(memberKeys.types(org), (prev) =>
                prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev,
              )
            }
            onDeleted={(id) =>
              queryClient.setQueryData<MemberType[]>(memberKeys.types(org), (prev) =>
                prev ? prev.filter((t) => t.id !== id) : prev,
              )
            }
            onCreated={(created) =>
              queryClient.setQueryData<MemberType[]>(memberKeys.types(org), (prev) =>
                prev ? [...prev, created] : prev,
              )
            }
            onReordered={(reordered) => queryClient.setQueryData(memberKeys.types(org), reordered)}
          />

          {roles.includes("admin") && (
            <p className="text-xs text-gray-400">
              団員が割り当てられている区分は削除できません。削除前に区分を変更してください。
            </p>
          )}
        </>
      )}
    </PageWithHeader>
  );
}
