"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Music, Loader2 } from "lucide-react";
import { authApi, type InviteInfo } from "@/lib/auth-api";
import { InviteForm } from "./_components/InviteForm";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();

  const [invite,    setInvite]    = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    authApi.getInvite(token)
      .then((data) => setInvite(data))
      .catch(() => setLoadError("招待リンクが無効または期限切れです。管理者に再発行を依頼してください。"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="text-sm text-gray-500 mt-1">合唱団運営支援サービス</p>
        </div>

        {loadError && (
          <div className="bg-white rounded-2xl border border-gray-200 px-8 py-8 text-center space-y-4">
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
