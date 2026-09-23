"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type NotificationItem } from "@/lib/notifications-api";
import { notificationKeys } from "@/lib/query-keys";
import { formatDate } from "@/lib/format-date";
import { useClickOutside } from "@/lib/useClickOutside";
import { useNotificationClick } from "@/lib/useNotificationClick";

const DROPDOWN_ITEM_LIMIT = 8;
const POLL_INTERVAL_MS = 60_000;

interface Props {
  org: string;
}

export default function NotificationBell({ org }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const notificationClick = useNotificationClick(org);

  useClickOutside(ref, () => setOpen(false), open);

  const { data } = useQuery({
    queryKey: notificationKeys.list(org),
    queryFn: () => notificationsApi.list(org, { perPage: DROPDOWN_ITEM_LIMIT }),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const items = data?.data ?? [];
  const unreadCount = data?.meta.unreadCount ?? 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  const handleItemClick = async (item: NotificationItem) => {
    setOpen(false);
    await notificationClick(item);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead(org);
      queryClient.invalidateQueries({ queryKey: notificationKeys.list(org) });
    } catch {
      // 失敗時は次回ポーリングで状態が復元される
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
        aria-label="通知"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1.5 w-80 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-medium text-gray-800">通知</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-brand-600 hover:text-brand-700 text-xs font-medium"
              >
                すべて既読にする
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">通知はありません</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item)}
                    className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                      item.readAt ? "" : "bg-blue-50"
                    }`}
                  >
                    <div className="flex w-full items-start gap-2">
                      {!item.readAt && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      )}
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          item.readAt ? "text-gray-600" : "font-semibold text-gray-800"
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100 px-4 py-2">
            <Link
              href={`/${org}/notifications`}
              onClick={() => setOpen(false)}
              className="text-brand-600 hover:text-brand-700 text-xs font-medium"
            >
              すべて見る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
