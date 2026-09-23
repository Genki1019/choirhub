"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type NotificationItem } from "@/lib/notifications-api";
import { notificationKeys } from "@/lib/query-keys";
import { formatDate } from "@/lib/format-date";
import { Pagination } from "@/components/Pagination";
import { PageWithHeader } from "@/components/PageWithHeader";

const PER_PAGE = 20;

export default function NotificationsPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const {
    data: result,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: [...notificationKeys.list(org), page],
    queryFn: () => notificationsApi.list(org, { page, perPage: PER_PAGE }),
  });

  const notifications = result?.data ?? [];
  const meta = result?.meta ?? { total: 0, page, perPage: PER_PAGE, unreadCount: 0 };

  const handleClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      try {
        await notificationsApi.markRead(org, item.id);
        queryClient.invalidateQueries({ queryKey: notificationKeys.list(org) });
      } catch {
        // 既読化に失敗しても遷移は継続する
      }
    }
    if (item.link) router.push(`/${org}${item.link}`);
  };

  return (
    <PageWithHeader
      title="通知"
      badge={!loading ? <span className="text-sm text-gray-400">{meta.total}件</span> : undefined}
      loading={loading}
      mainClassName="space-y-4"
    >
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{error.message}</span>
        </div>
      )}

      {!error && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Bell size={28} className="mb-3 opacity-40" />
          <p className="text-sm">通知はありません</p>
        </div>
      )}

      {!error && notifications.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {notifications.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className={`flex w-full items-start gap-3 border-b border-gray-100 px-6 py-4 text-left transition-colors last:border-0 hover:bg-gray-50 ${
                item.readAt ? "" : "bg-blue-50"
              }`}
            >
              {!item.readAt && (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-sm ${
                      item.readAt ? "text-gray-600" : "font-semibold text-gray-800"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                {item.body && <p className="mt-1 truncate text-xs text-gray-400">{item.body}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Pagination meta={meta} onPageChange={setPage} />
    </PageWithHeader>
  );
}
