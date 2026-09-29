import { apiClient, downloadFile, toApiClientError } from "./api-client";

export type AuditCategory = "access" | "org" | "export" | "finance";

export type AuditValue = string | number | boolean | null | AuditValue[];

export interface AuditLogItem {
  id: string;
  createdAt: string;
  actorType: "member" | "system_admin" | "system";
  actorMemberId: string | null;
  actorName: string;
  action: string;
  category: AuditCategory | null;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  changes: Record<string, { before: AuditValue; after: AuditValue }> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditLogListResponse {
  data: AuditLogItem[];
  meta: { total: number; page: number; perPage: number };
}

export type AuditLogActor =
  { type: "member"; memberId: string; name: string } | { type: "system_admin"; name: string };

export interface AuditLogFilter {
  from?: string;
  to?: string;
  actorId?: string;
  actorType?: "system_admin";
  category?: AuditCategory;
}

function toQuery(params: AuditLogFilter & { page?: number }): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export const auditLogsApi = {
  list: (orgSlug: string, params: AuditLogFilter & { page?: number }) =>
    fetch(`/api/v1/${orgSlug}/settings/audit-logs${toQuery(params)}`, {
      credentials: "include",
      cache: "no-store",
    }).then(async (res) => {
      if (!res.ok) throw await toApiClientError(res);
      return res.json() as Promise<AuditLogListResponse>;
    }),

  actors: (orgSlug: string) =>
    apiClient.get<AuditLogActor[]>(`/${orgSlug}/settings/audit-logs/actors`),

  exportCsv: (orgSlug: string, filter: AuditLogFilter) =>
    downloadFile(`/${orgSlug}/settings/audit-logs/export${toQuery(filter)}`),
};
