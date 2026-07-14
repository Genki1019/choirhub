"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { settingsPageTitle } from "@/lib/settings-nav";
import { SettingsPageShell } from "./_components/SettingsPageShell";
import { OrgSettingsForm } from "./_components/OrgSettingsForm";
import { DangerZone } from "./_components/DangerZone";

export default function SettingsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();

  const {
    data: settings,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: settingsKeys.org(org),
    queryFn: () => settingsApi.get(org),
  });

  return (
    <SettingsPageShell title={settingsPageTitle("")} loading={loading}>
      {error ? (
        <div className="flex items-center justify-center py-16 text-sm text-red-500">
          {error.message}
        </div>
      ) : (
        <>
          <OrgSettingsForm
            orgSlug={org}
            initialName={settings?.name ?? ""}
            initialSlug={settings?.slug ?? ""}
          />
          {roles.includes("admin") && <DangerZone />}
        </>
      )}
    </SettingsPageShell>
  );
}
