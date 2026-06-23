"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import { PartCard } from "./_components/PartCard";

export default function PartsPage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const [parts,   setParts]   = useState<PartSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    membersApi.parts(org)
      .then((data) => setParts([...data].sort((a, b) => a.sortOrder - b.sortOrder)))
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

      <PartCard initialParts={parts} org={org} onToast={showToast} />

      <p className="text-xs text-gray-400">
        ↑↓ で表示順を変更できます。在団メンバーが所属しているパートは削除できません。
      </p>
    </div>
  );
}
