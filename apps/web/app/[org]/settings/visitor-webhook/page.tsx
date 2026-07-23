"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw, Copy } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";
import { settingsPageTitle, SETTINGS_MAIN_CLASS_NAME } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { useClipboardCopy } from "@/hooks/useClipboardCopy";
import { useTokenIssuance } from "@/hooks/useTokenIssuance";
import { PageWithHeader } from "@/components/PageWithHeader";
import { IntroTemplateCard } from "./_components/IntroTemplateCard";

export default function VisitorWebhookPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const isAdmin = roles.includes("admin");
  const { copiedKey, copy } = useClipboardCopy();
  // Next.jsのrewriteで /api/v1/* は常にAPIへプロキシされるため、
  // NEXT_PUBLIC_API_URL未設定環境でも同一オリジンのURLがそのまま使える
  const [webhookUrl, setWebhookUrl] = useState("/api/v1/public/visitor-applications");

  useEffect(() => {
    const resolve = () =>
      setWebhookUrl(`${window.location.origin}/api/v1/public/visitor-applications`);
    resolve();
  }, []);

  const { data, isLoading, regenerating, error, handleRegenerate } = useTokenIssuance(
    settingsKeys.visitorWebhook(org),
    () => settingsApi.getVisitorWebhookToken(org),
    () => settingsApi.regenerateVisitorWebhookToken(org),
    { enabled: isAdmin },
  );

  return (
    <PageWithHeader
      title={settingsPageTitle("/visitor-webhook")}
      loading={isLoading}
      mainClassName={SETTINGS_MAIN_CLASS_NAME}
    >
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs text-gray-500">
          Googleフォームの送信時にApps
          Scriptからこのエンドポイントへ回答を送信すると、見学申込として自動的に取り込まれます。
        </p>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Webhook URL</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
            />
            <button
              onClick={() => copy(webhookUrl, "url")}
              className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50"
              aria-label="Webhook URLをコピー"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">トークン</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={data?.token ?? "未発行"}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
            />
            {data?.token && (
              <button
                onClick={() => copy(data.token as string, "token")}
                className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50"
                aria-label="トークンをコピー"
              >
                <Copy size={14} />
              </button>
            )}
          </div>
          {copiedKey && <p className="mt-1 text-xs text-teal-600">コピーしました</p>}
        </div>

        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
        >
          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {data?.token ? "再発行する" : "発行する"}
        </button>
        {data?.token && (
          <p className="text-xs text-gray-400">
            再発行すると、これまでのトークンを使ったWebhookは無効になります。
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <IntroTemplateCard org={org} />
    </PageWithHeader>
  );
}
