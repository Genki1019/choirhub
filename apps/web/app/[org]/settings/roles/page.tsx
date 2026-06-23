"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { ROLE_LABELS, type RoleKey } from "@/lib/roles";
import { RoleNamesForm } from "./_components/RoleNamesForm";

export default function RolesPage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const [names,   setNames]   = useState<Record<RoleKey, string>>({ ...ROLE_LABELS } as Record<RoleKey, string>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.get(org)
      .then((data) => {
        setNames((prev) => ({ ...prev, ...data.roleNames }) as Record<RoleKey, string>);
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
    <div className="max-w-2xl">
      <RoleNamesForm orgSlug={org} initialNames={names} />
    </div>
  );
}
