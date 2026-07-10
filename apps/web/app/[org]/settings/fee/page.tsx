"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { FeeSettingsForm } from "./_components/FeeSettingsForm";

export default function FeeSettingsPage() {
  const { org } = useParams<{ org: string }>();

  const { data: feeData, isLoading: loading } = useQuery({
    queryKey: settingsKeys.fee(org),
    queryFn:  () => settingsApi.getFee(org),
  });

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center py-4">
          <h1 className="text-lg font-semibold text-gray-800">会費設定</h1>
        </PageBleedRow>
      </header>

      <PageMain>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="max-w-lg">
            <FeeSettingsForm
              orgSlug={org}
              initialFeeType={feeData?.feeType ?? "per_rehearsal"}
              initialAmount={feeData?.defaultFeeAmount != null ? String(feeData.defaultFeeAmount) : ""}
            />
          </div>
        )}
      </PageMain>
    </div>
  );
}
