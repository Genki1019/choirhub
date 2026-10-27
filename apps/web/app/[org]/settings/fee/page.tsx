"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { PageWithHeader } from "@/components/PageWithHeader";
import { FeeSettingsForm } from "./_components/FeeSettingsForm";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

export default function FeeSettingsPage() {
  const { org } = useParams<{ org: string }>();

  const {
    data: feeData,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: settingsKeys.fee(org),
    queryFn: () => settingsApi.getFee(org),
  });

  return (
    <PageWithHeader
      title={settingsPageTitle("/fee")}
      loading={loading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      {error && !feeData ? (
        <ErrorMessage variant="section" autoScroll={false}>
          {userErrorMessage(
            error,
            "会費設定の読み込みに失敗しました。ページを再読み込みしてください。",
          )}
        </ErrorMessage>
      ) : (
        <>
          <FeeSettingsForm
            orgSlug={org}
            initialFeeType={feeData?.feeType ?? "per_rehearsal"}
            initialAmount={
              feeData?.defaultFeeAmount != null ? String(feeData.defaultFeeAmount) : ""
            }
          />
        </>
      )}
    </PageWithHeader>
  );
}
