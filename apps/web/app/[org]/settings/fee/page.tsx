"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { FeeSettingsForm } from "./_components/FeeSettingsForm";

export default function FeeSettingsPage() {
  const { org } = useParams<{ org: string }>();

  const { data: feeData, isLoading: loading } = useQuery({
    queryKey: settingsKeys.fee(org),
    queryFn:  () => settingsApi.getFee(org),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <FeeSettingsForm
        orgSlug={org}
        initialFeeType={feeData?.feeType ?? "per_rehearsal"}
        initialAmount={feeData?.defaultFeeAmount != null ? String(feeData.defaultFeeAmount) : ""}
      />
    </div>
  );
}
