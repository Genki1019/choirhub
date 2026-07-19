"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import type { MemberType } from "@/lib/settings-api";
import { memberKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useToast } from "@/hooks/useToast";
import { MemberTypeCard } from "./_components/MemberTypeCard";

export default function MemberTypesPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();

  const { data: types = [], isLoading: loading } = useQuery({
    queryKey: memberKeys.types(org),
    queryFn: () => settingsApi.listMemberTypes(org),
  });

  return (
    <PageWithHeader
      title={settingsPageTitle("/member-types")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

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
        onToast={showToast}
      />

      {roles.includes("admin") && (
        <p className="text-xs text-gray-400">
          団員が割り当てられている区分は削除できません。削除前に区分を変更してください。
        </p>
      )}
    </PageWithHeader>
  );
}
