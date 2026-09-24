import { apiClient } from "./api-client";

export type InquiryCategory = "org_restore" | "account" | "privacy" | "bug_report" | "other";

export const INQUIRY_CATEGORY_OPTIONS: { key: InquiryCategory; label: string }[] = [
  { key: "org_restore", label: "削除した団体の復元" },
  { key: "account", label: "アカウント・ログイン" },
  { key: "privacy", label: "個人情報の開示・訂正・削除" },
  { key: "bug_report", label: "不具合の報告" },
  { key: "other", label: "その他" },
];

export const INQUIRY_CATEGORY_LABELS = Object.fromEntries(
  INQUIRY_CATEGORY_OPTIONS.map((opt) => [opt.key, opt.label]),
) as Record<InquiryCategory, string>;

export function isInquiryCategory(value: unknown): value is InquiryCategory {
  return INQUIRY_CATEGORY_OPTIONS.some((opt) => opt.key === value);
}

export interface InquiryFields {
  category: InquiryCategory;
  name: string;
  email: string;
  orgName?: string;
  message: string;
}

export interface Inquiry {
  id: string;
  category: InquiryCategory;
  name: string;
  email: string;
  orgName: string | null;
  message: string;
  status: "open" | "resolved";
  resolvedByEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export const inquiriesApi = {
  create: (data: InquiryFields) => apiClient.post<{ message: string }>("/auth/inquiries", data),

  listOpen: () => apiClient.get<Inquiry[]>("/auth/inquiries?status=open"),

  resolve: (id: string) => apiClient.post<Inquiry>(`/auth/inquiries/${id}/resolve`, {}),
};
