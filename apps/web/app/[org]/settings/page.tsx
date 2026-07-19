"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { PageWithHeader } from "@/components/PageWithHeader";
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
    <PageWithHeader
      title={settingsPageTitle("")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
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
            canEdit={roles.includes("admin")}
          />
          {roles.includes("admin") && <DangerZone />}
        </>
      )}
    </PageWithHeader>
  );
}
