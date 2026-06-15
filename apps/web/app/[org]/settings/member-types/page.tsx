"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { MemberType } from "@/lib/settings-api";
import { MemberTypeCard } from "./_components/MemberTypeCard";

export default function MemberTypesPage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const [types,   setTypes]   = useState<MemberType[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    settingsApi.listMemberTypes(org)
      .then(setTypes)
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
    <div className="max-w-md space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <MemberTypeCard
        types={types}
        org={org}
        onUpdated={(updated) => setTypes((prev) => prev.map((t) => t.id === updated.id ? updated : t))}
        onDeleted={(id) => setTypes((prev) => prev.filter((t) => t.id !== id))}
        onCreated={(created) => setTypes((prev) => [...prev, created])}
        onToast={showToast}
      />

      <p className="text-xs text-gray-400">
        団員が割り当てられている区分は削除できません。削除前に区分を変更してください。
      </p>
    </div>
  );
}
