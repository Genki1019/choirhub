"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { membersApi } from "@/lib/members-api";
import { memberKeys } from "@/lib/query-keys";
import { settingsPageTitle } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { SettingsPageShell } from "../_components/SettingsPageShell";
import { PartCard } from "./_components/PartCard";

export default function PartsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const [toast, setToast] = useState<string | null>(null);

  const { data: parts = [], isLoading: loading } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    select: (data) => [...data].sort((a, b) => a.sortOrder - b.sortOrder),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <SettingsPageShell title={settingsPageTitle("/parts")} loading={loading}>
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-lg bg-gray-800 px-4 py-2.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

      <PartCard
        initialParts={parts}
        org={org}
        canEdit={roles.includes("admin")}
        onToast={showToast}
      />

      {roles.includes("admin") && (
        <p className="text-xs text-gray-400">
          ↑↓ で表示順を変更できます。在団メンバーが所属しているパートは削除できません。
        </p>
      )}
    </SettingsPageShell>
  );
}
