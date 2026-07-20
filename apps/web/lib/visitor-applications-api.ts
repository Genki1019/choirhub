import { apiClient } from "./api-client";
import type { VisitorApplication, VisitorApplicationDraft } from "./api-types";

export type { VisitorApplication, VisitorApplicationDraft };

export const visitorApplicationsApi = {
  create: (
    orgSlug: string,
    data: {
      name: string;
      partHope?: string;
      originGroup?: string;
      contact?: string;
      message?: string;
    },
  ) => apiClient.post<VisitorApplication>(`/${orgSlug}/visitor-applications`, data),

  listPending: (orgSlug: string) =>
    apiClient.get<VisitorApplication[]>(`/${orgSlug}/visitor-applications?status=pending`),

  approve: (orgSlug: string, id: string) =>
    apiClient.post<{ application: VisitorApplication; draft: VisitorApplicationDraft }>(
      `/${orgSlug}/visitor-applications/${id}/approve`,
      {},
    ),

  reject: (orgSlug: string, id: string) =>
    apiClient.post<VisitorApplication>(`/${orgSlug}/visitor-applications/${id}/reject`, {}),

  bulkApprove: (orgSlug: string, ids: string[]) =>
    apiClient.post<{ applications: VisitorApplication[]; draft: VisitorApplicationDraft }>(
      `/${orgSlug}/visitor-applications/bulk-approve`,
      { ids },
    ),
};
