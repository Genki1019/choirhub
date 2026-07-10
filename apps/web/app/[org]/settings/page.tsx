"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { OrgSettingsForm } from "./_components/OrgSettingsForm";
import { DangerZone } from "./_components/DangerZone";

export default function SettingsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();

  const { data: settings, isLoading: loading, error } = useQuery({
    queryKey: settingsKeys.org(org),
    queryFn:  () => settingsApi.get(org),
  });

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center py-4">
          <h1 className="text-lg font-semibold text-gray-800">団体情報</h1>
        </PageBleedRow>
      </header>

      <PageMain>
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-16 text-sm text-red-500">
            {error.message}
          </div>
        )}

        {!loading && !error && (
          <div className="max-w-lg space-y-5">
            <OrgSettingsForm orgSlug={org} initialName={settings?.name ?? ""} initialSlug={settings?.slug ?? ""} />
            {roles.includes("admin") && <DangerZone />}
          </div>
        )}
      </PageMain>
    </div>
  );
}
