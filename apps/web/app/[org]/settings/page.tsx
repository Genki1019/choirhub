"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { OrgSettingsForm } from "./_components/OrgSettingsForm";
import { DangerZone } from "./_components/DangerZone";

export default function SettingsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();

  const { data: settings, isLoading: loading, error } = useQuery({
    queryKey: settingsKeys.org(org),
    queryFn:  () => settingsApi.get(org),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-red-500">
        {error.message}
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <OrgSettingsForm orgSlug={org} initialName={settings?.name ?? ""} initialSlug={settings?.slug ?? ""} />
      {roles.includes("admin") && <DangerZone />}
    </div>
  );
}
