"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { ROLE_LABELS, type RoleKey } from "@/lib/roles";
import { RoleNamesForm } from "./_components/RoleNamesForm";

export default function RolesPage() {
  const { org } = useParams<{ org: string }>();

  const { data: settings, isLoading: loading } = useQuery({
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

  const names = { ...ROLE_LABELS, ...settings?.roleNames } as Record<RoleKey, string>;

  return (
    <div className="max-w-2xl">
      <RoleNamesForm orgSlug={org} initialNames={names} />
    </div>
  );
}
