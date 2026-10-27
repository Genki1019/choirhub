"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type OrgSettings } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";
import { OrgSettingsForm } from "./_components/OrgSettingsForm";
import { DangerZone } from "./_components/DangerZone";

export default function SettingsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const queryClient = useQueryClient();

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
      {error && !settings ? (
        <ErrorMessage variant="section" autoScroll={false}>
          {userErrorMessage(
            error,
            "団体設定の読み込みに失敗しました。ページを再読み込みしてください。",
          )}
        </ErrorMessage>
      ) : (
        <>
          <OrgSettingsForm
            orgSlug={org}
            initialName={settings?.name ?? ""}
            initialSlug={settings?.slug ?? ""}
            canEdit={roles.includes("admin")}
            onSaved={(updated) =>
              queryClient.setQueryData<OrgSettings>(settingsKeys.org(org), updated)
            }
          />
          {roles.includes("admin") && <DangerZone orgSlug={org} orgName={settings?.name ?? ""} />}
        </>
      )}
    </PageWithHeader>
  );
}
