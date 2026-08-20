import { apiClient } from "./api-client";

export type PartTemplateKey = "mixed4" | "women3" | "mens4" | "custom";

export const PART_TEMPLATE_OPTIONS: { key: PartTemplateKey; label: string }[] = [
  { key: "mixed4", label: "混声四部" },
  { key: "women3", label: "女声三部" },
  { key: "mens4", label: "男声四部" },
  { key: "custom", label: "カスタム（あとで手動設定）" },
];

export const PART_TEMPLATE_LABELS: Record<PartTemplateKey, string> = Object.fromEntries(
  PART_TEMPLATE_OPTIONS.map((opt) => [opt.key, opt.label]),
) as Record<PartTemplateKey, string>;

export interface OrgApplication {
  id: string;
  orgName: string;
  slug: string;
  templateKey: PartTemplateKey;
  applicantName: string;
  applicantEmail: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface OrgCreateFields {
  orgName: string;
  slug: string;
  templateKey: PartTemplateKey;
  applicantName: string;
  applicantEmail: string;
  message?: string;
}

export const orgApplicationsApi = {
  create: (data: OrgCreateFields) =>
    apiClient.post<{ message: string }>("/auth/org-applications", data),

  createDirect: (data: OrgCreateFields) => apiClient.post<{ message: string }>("/auth/orgs", data),

  listPending: () => apiClient.get<OrgApplication[]>("/auth/org-applications?status=pending"),

  approve: (id: string, slug?: string) =>
    apiClient.post<OrgApplication>(`/auth/org-applications/${id}/approve`, { slug }),

  reject: (id: string) => apiClient.post<OrgApplication>(`/auth/org-applications/${id}/reject`, {}),
};
