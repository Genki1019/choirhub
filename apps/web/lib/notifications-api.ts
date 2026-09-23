import { apiClient } from "./api-client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListMeta {
  total: number;
  page: number;
  perPage: number;
  unreadCount: number;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  meta: NotificationListMeta;
}

export type NotificationStatusFilter = "all" | "unread" | "read";

export interface NotificationListParams {
  page?: number;
  perPage?: number;
  status?: NotificationStatusFilter;
}

export const notificationsApi = {
  list: (
    orgSlug: string,
    params: NotificationListParams = {},
  ): Promise<NotificationListResponse> => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    if (params.status && params.status !== "all") qs.set("status", params.status);
    const query = qs.toString();
    return fetch(`/api/v1/${orgSlug}/notifications${query ? `?${query}` : ""}`, {
      credentials: "include",
      cache: "no-store",
    }).then(async (res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json() as Promise<NotificationListResponse>;
    });
  },

  markRead: (orgSlug: string, id: string) =>
    apiClient.patch<void>(`/${orgSlug}/notifications/${id}/read`, {}),

  markAllRead: (orgSlug: string) => apiClient.patch<void>(`/${orgSlug}/notifications/read-all`, {}),
};
