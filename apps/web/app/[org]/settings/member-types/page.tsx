"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import type { MemberType } from "@/lib/settings-api";
import { memberKeys } from "@/lib/query-keys";
import { settingsPageTitle } from "@/lib/settings-nav";
import { SettingsPageShell } from "../_components/SettingsPageShell";
import { MemberTypeCard } from "./_components/MemberTypeCard";

export default function MemberTypesPage() {
  const { org } = useParams<{ org: string }>();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const { data: types = [], isLoading: loading } = useQuery({
    queryKey: memberKeys.types(org),
    queryFn:  () => settingsApi.listMemberTypes(org),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <SettingsPageShell title={settingsPageTitle("/member-types")} loading={loading}>
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <MemberTypeCard
        types={types}
        org={org}
        onUpdated={(updated) => queryClient.setQueryData<MemberType[]>(memberKeys.types(org), (prev) =>
          prev ? prev.map((t) => t.id === updated.id ? updated : t) : prev
        )}
        onDeleted={(id) => queryClient.setQueryData<MemberType[]>(memberKeys.types(org), (prev) =>
          prev ? prev.filter((t) => t.id !== id) : prev
        )}
        onCreated={(created) => queryClient.setQueryData<MemberType[]>(memberKeys.types(org), (prev) =>
          prev ? [...prev, created] : prev
        )}
        onToast={showToast}
      />

      <p className="text-xs text-gray-400">
        団員が割り当てられている区分は削除できません。削除前に区分を変更してください。
      </p>
    </SettingsPageShell>
  );
}
