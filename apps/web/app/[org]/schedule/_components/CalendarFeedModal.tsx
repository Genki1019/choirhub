"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { eventsApi } from "@/lib/events-api";
import { eventKeys } from "@/lib/query-keys";
import { useClipboardCopy } from "@/hooks/useClipboardCopy";
import { useTokenIssuance } from "@/hooks/useTokenIssuance";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface CalendarFeedModalProps {
  orgSlug: string;
  onClose: () => void;
}

export function CalendarFeedModal({ orgSlug, onClose }: CalendarFeedModalProps) {
  const { copiedKey, copy } = useClipboardCopy();
  const [origin, setOrigin] = useState("");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  useEffect(() => {
    const resolve = () => setOrigin(window.location.origin);
    resolve();
  }, []);

  const { data, isLoading, regenerating, error, handleRegenerate, clearError } = useTokenIssuance(
    eventKeys.calendarFeedToken(orgSlug),
    () => eventsApi.getCalendarFeedToken(orgSlug),
    () => eventsApi.regenerateCalendarFeedToken(orgSlug),
  );

  const feedUrl = data?.token
    ? `${origin}/api/v1/calendar/${orgSlug}/feed.ics?token=${data.token}`
    : null;
  const googleCalendarUrl = feedUrl
    ? `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(feedUrl)}`
    : null;

  return (
    <>
      <Modal title="外部カレンダーに連携" onClose={onClose}>
        <p className="text-xs text-gray-500">
          自分が招待されているスケジュールを、Googleカレンダー・Apple
          Calendarなど外部カレンダーアプリに購読形式で連携できます。登録後は最大24時間遅延で自動更新されます。
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {feedUrl && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    フィードURL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={feedUrl}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => copy(feedUrl, "url")}
                      className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50"
                      aria-label="URLをコピー"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <p role="status" className="mt-1 text-xs text-teal-600">
                    {copiedKey === "url" ? "コピーしました" : ""}
                  </p>
                </div>

                <a
                  href={googleCalendarUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-brand-600 hover:bg-brand-700 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
                >
                  <ExternalLink size={14} />
                  Googleカレンダーに追加
                </a>
              </>
            )}

            <button
              type="button"
              onClick={() => (data?.token ? setConfirmRegenerate(true) : handleRegenerate())}
              disabled={regenerating}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {regenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {data?.token ? "再発行する" : "発行する"}
            </button>
            {data?.token && (
              <p className="text-xs text-gray-400">
                再発行すると、これまでのフィードURLは無効になります。
              </p>
            )}
          </>
        )}
        {!confirmRegenerate && <ErrorMessage>{error}</ErrorMessage>}
      </Modal>

      {confirmRegenerate && (
        <ConfirmDialog
          title="フィードURLを再発行しますか？"
          description="これまでのフィードURLは無効になり、登録済みの外部カレンダーの予定が更新されなくなります。新しいURLで登録し直してください。"
          confirmLabel="再発行する"
          busy={regenerating}
          error={error}
          onCancel={() => {
            setConfirmRegenerate(false);
            clearError();
          }}
          onConfirm={async () => {
            if (await handleRegenerate()) setConfirmRegenerate(false);
          }}
        />
      )}
    </>
  );
}
