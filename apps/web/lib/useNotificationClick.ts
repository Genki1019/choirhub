import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type NotificationItem } from "@/lib/notifications-api";
import { notificationKeys } from "@/lib/query-keys";

// 通知クリック時の「未読なら既読化 → リンク先へ遷移」の挙動を共通化する
export function useNotificationClick(org: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async (item: NotificationItem) => {
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
}
