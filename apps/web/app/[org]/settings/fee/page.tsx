"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { FeeSettingsForm } from "./_components/FeeSettingsForm";

export default function FeeSettingsPage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const [feeType, setFeeType] = useState<"per_rehearsal" | "monthly">("per_rehearsal");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.getFee(org)
      .then((data) => {
        setFeeType(data.feeType);
        setAmount(data.defaultFeeAmount != null ? String(data.defaultFeeAmount) : "");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [org, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <FeeSettingsForm orgSlug={org} initialFeeType={feeType} initialAmount={amount} />
    </div>
  );
}
