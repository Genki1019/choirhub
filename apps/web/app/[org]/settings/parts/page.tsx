"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { membersApi } from "@/lib/members-api";
import { memberKeys } from "@/lib/query-keys";
import { PartCard } from "./_components/PartCard";

export default function PartsPage() {
  const { org } = useParams<{ org: string }>();
  const [toast, setToast] = useState<string | null>(null);

  const { data: parts = [], isLoading: loading } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn:  () => membersApi.parts(org),
    select:   (data) => [...data].sort((a, b) => a.sortOrder - b.sortOrder),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
