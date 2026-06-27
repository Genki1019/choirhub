import { apiClient } from "./api-client";
import type { MemberProfile, PartSummary, InviteResult } from "./api-types";

export type { MemberProfile, PartSummary };

export interface MembersQuery {
  partId?: string;
  status?: string;
  role?: string;
}

export const membersApi = {
  parts: (orgSlug: string) =>
    apiClient.get<PartSummary[]>(`/${orgSlug}/parts`),

  list: (orgSlug: string, query?: MembersQuery) => {
    const params = new URLSearchParams();
    if (query?.partId) params.set("partId", query.partId);
    if (query?.status) params.set("status", query.status);
    if (query?.role) params.set("role", query.role);
    const qs = params.toString();
    return apiClient.get<MemberProfile[]>(`/${orgSlug}/members${qs ? `?${qs}` : ""}`);
  },

  me: (orgSlug: string) =>
    apiClient.get<MemberProfile>(`/${orgSlug}/members/me`),

  get: (orgSlug: string, memberId: string) =>
    apiClient.get<MemberProfile>(`/${orgSlug}/members/${memberId}`),

  updateMe: (orgSlug: string, data: Partial<MemberProfile>) =>
    apiClient.patch<MemberProfile>(`/${orgSlug}/members/me`, data),

  updateById: (orgSlug: string, memberId: string, data: Record<string, unknown>) =>
    apiClient.patch<MemberProfile>(`/${orgSlug}/members/${memberId}`, data),

  invite: (orgSlug: string, data: { email: string; nameJa?: string; roles: string[]; partId?: string }) =>
    apiClient.post<InviteResult>(`/${orgSlug}/members/invite`, data),

  delete: (orgSlug: string, memberId: string) =>
    apiClient.delete(`/${orgSlug}/members/${memberId}`),
};
