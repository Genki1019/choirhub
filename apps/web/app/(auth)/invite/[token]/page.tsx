"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Music, Loader2 } from "lucide-react";
import { authApi, type InviteInfo } from "@/lib/auth-api";
import { InviteForm } from "./_components/InviteForm";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .getInvite(token)
      .then((data) => setInvite(data))
      .catch(() =>
        setLoadError("招待リンクが無効または期限切れです。管理者に再発行を依頼してください。"),
      );
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="bg-brand-600 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="mt-1 text-sm text-gray-500">合唱団運営支援サービス</p>
        </div>

        {loadError && (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
          </div>
        )}

        {!loadError && !invite && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {invite && <InviteForm token={token} invite={invite} />}
      </div>
    </div>
  );
}
