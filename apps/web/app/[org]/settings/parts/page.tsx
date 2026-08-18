"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { memberKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useToast } from "@/hooks/useToast";
import { PartCard } from "./_components/PartCard";

export default function PartsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();

  const { data: parts = [], isLoading: loading } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    select: (data) => [...data].sort((a, b) => a.sortOrder - b.sortOrder),
  });

  return (
    <PageWithHeader
      title={settingsPageTitle("/parts")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

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
        onToast={showToast}
      />

      {roles.includes("admin") && (
        <p className="text-xs text-gray-400">
          ドラッグして表示順を変更できます。在団メンバーが所属しているパートは削除できません。
        </p>
      )}
    </PageWithHeader>
  );
}
