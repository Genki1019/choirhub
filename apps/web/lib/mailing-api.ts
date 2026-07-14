import { apiClient } from "./api-client";

export type RecipientType = "all" | "part" | "role" | "custom";

export interface ResendDetail {
  subject: string;
  html: string | null;
  text: string | null;
  lastEvent: string;
  createdAt: string;
}

export interface MailSummary {
  id: string;
  sentBy: { id: string; nameJa: string; avatarUrl: string | null };
  sentAt: string;
  recipientCount: number;
  subject: string;
  bodyPreview: string;
}

export interface MailRecipient {
  email: string;
  lastEvent: string;
}

export interface MailDetail {
  id: string;
  sentBy: { id: string; nameJa: string };
  sentAt: string;
  recipientCount: number;
  recipientMemberIds: string[];
  recipients: MailRecipient[];
  resend: ResendDetail | null;
}

export interface MailListMeta {
  total: number;
  page: number;
  perPage: number;
}

export interface MailListResponse {
  data: MailSummary[];
  meta: MailListMeta;
}

export interface MailListParams {
  page?: number;
  perPage?: number;
}

export interface SendMailInput {
  subject: string;
  body: string;
  recipientType: RecipientType;
  recipientFilter?: {
    partIds?: string[];
    roles?: string[];
    memberIds?: string[];
  } | null;
}

export interface SendMailResult {
  mailLogId: string;
  recipientCount: number;
  sentAt: string;
}

export interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdBy: { id: string; nameJa: string };
  updatedAt: string;
}

export interface SaveTemplateInput {
  name: string;
  subject: string;
  body: string;
}

export const mailingApi = {
  list: (orgSlug: string, params: MailListParams = {}): Promise<MailListResponse> => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    const query = qs.toString();
    return fetch(`/api/v1/${orgSlug}/mailing${query ? `?${query}` : ""}`, {
      credentials: "include",
      cache: "no-store",
    }).then(async (res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json() as Promise<MailListResponse>;
    });
  },

  get: (orgSlug: string, id: string) => apiClient.get<MailDetail>(`/${orgSlug}/mailing/${id}`),

  send: (orgSlug: string, data: SendMailInput) =>
    apiClient.post<SendMailResult>(`/${orgSlug}/mailing/send`, data),

  templates: {
    list: (orgSlug: string) => apiClient.get<MailTemplate[]>(`/${orgSlug}/mailing/templates`),
    save: (orgSlug: string, data: SaveTemplateInput) =>
      apiClient.post<MailTemplate>(`/${orgSlug}/mailing/templates`, data),
    update: (orgSlug: string, id: string, data: Partial<SaveTemplateInput>) =>
      apiClient.patch<MailTemplate>(`/${orgSlug}/mailing/templates/${id}`, data),
    delete: (orgSlug: string, id: string) =>
      apiClient.delete(`/${orgSlug}/mailing/templates/${id}`),
  },
};

export const LAST_EVENT_LABEL: Record<string, { label: string; color: string }> = {
  sent: { label: "送信済み", color: "text-blue-600 bg-blue-50" },
  delivered: { label: "配信完了", color: "text-green-600 bg-green-50" },
  opened: { label: "開封済み", color: "text-green-700 bg-green-100" },
  clicked: { label: "リンク押下", color: "text-purple-600 bg-purple-50" },
  bounced: { label: "バウンス", color: "text-red-600 bg-red-50" },
  complained: { label: "スパム報告", color: "text-red-700 bg-red-100" },
  unsubscribed: { label: "配信停止", color: "text-gray-600 bg-gray-100" },
};
