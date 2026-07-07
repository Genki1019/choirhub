"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { useMember } from "@/contexts/MemberContext";
import { ApiClientError } from "@/lib/api-client";
import { OrgSettingsForm } from "./_components/OrgSettingsForm";
import { DangerZone } from "./_components/DangerZone";

export default function SettingsPage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const { roles } = useMember();
  const [initialName, setInitialName] = useState("");
  const [initialSlug, setInitialSlug] = useState("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    settingsApi.get(org)
      .then((settings) => {
        setInitialName(settings.name);
        setInitialSlug(settings.slug);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
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

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <OrgSettingsForm orgSlug={org} initialName={initialName} initialSlug={initialSlug} />
      {roles.includes("admin") && <DangerZone />}
    </div>
  );
}
