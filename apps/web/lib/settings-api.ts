import { apiClient } from "./api-client";
import type { PartSummary } from "./members-api";
import type { ExpenseCategory } from "./accounting-api";

export interface EventCategory {
  id: string;
  name: string;
  slug: string | null;
  color: string;
  sortOrder: number;
}

export interface MemberType {
  id: string;
  name: string;
  defaultFeeAmount: number | null;
  sortOrder: number;
}

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
}

export interface FeeSettings {
  feeType: "per_rehearsal" | "monthly";
  defaultFeeAmount: number | null;
}

export interface VisitorWebhookSettings {
  token: string | null;
}

export interface VisitorIntroTemplate {
  subjectTemplate: string;
  bodyTemplate: string;
  lineTemplate: string;
}

export const settingsApi = {
  get: (orgSlug: string) => apiClient.get<OrgSettings>(`/${orgSlug}/settings`),

  update: (orgSlug: string, data: { name?: string }) =>
    apiClient.patch<OrgSettings>(`/${orgSlug}/settings`, data),

  createPart: (orgSlug: string, data: { name: string; voiceType?: string }) =>
    apiClient.post<PartSummary>(`/${orgSlug}/parts`, data),

  updatePart: (orgSlug: string, partId: string, data: { name?: string; sortOrder?: number }) =>
    apiClient.patch<PartSummary>(`/${orgSlug}/parts/${partId}`, data),

  deletePart: (orgSlug: string, partId: string) => apiClient.delete(`/${orgSlug}/parts/${partId}`),

  getFee: (orgSlug: string) => apiClient.get<FeeSettings>(`/${orgSlug}/settings/org`),

  updateFee: (
    orgSlug: string,
    data: { feeType?: "per_rehearsal" | "monthly"; defaultFeeAmount?: number | null },
  ) => apiClient.patch<FeeSettings>(`/${orgSlug}/settings/fee`, data),

  listExpenseCategories: (orgSlug: string) =>
    apiClient.get<ExpenseCategory[]>(`/${orgSlug}/settings/expense-categories`),

  createExpenseCategory: (orgSlug: string, data: { name: string; sortOrder?: number }) =>
    apiClient.post<ExpenseCategory>(`/${orgSlug}/settings/expense-categories`, data),

  updateExpenseCategory: (
    orgSlug: string,
    categoryId: string,
    data: { name?: string; sortOrder?: number },
  ) =>
    apiClient.patch<ExpenseCategory>(`/${orgSlug}/settings/expense-categories/${categoryId}`, data),

  deleteExpenseCategory: (orgSlug: string, categoryId: string) =>
    apiClient.delete(`/${orgSlug}/settings/expense-categories/${categoryId}`),

  listMemberTypes: (orgSlug: string) =>
    apiClient.get<MemberType[]>(`/${orgSlug}/settings/member-types`),

  createMemberType: (
    orgSlug: string,
    data: { name: string; defaultFeeAmount?: number | null; sortOrder?: number },
  ) => apiClient.post<MemberType>(`/${orgSlug}/settings/member-types`, data),

  updateMemberType: (
    orgSlug: string,
    typeId: string,
    data: { name?: string; defaultFeeAmount?: number | null; sortOrder?: number },
  ) => apiClient.patch<MemberType>(`/${orgSlug}/settings/member-types/${typeId}`, data),

  deleteMemberType: (orgSlug: string, typeId: string) =>
    apiClient.delete(`/${orgSlug}/settings/member-types/${typeId}`),

  listEventCategories: (orgSlug: string) =>
    apiClient.get<EventCategory[]>(`/${orgSlug}/settings/event-categories`),

  createEventCategory: (
    orgSlug: string,
    data: { name: string; color?: string; sortOrder?: number },
  ) => apiClient.post<EventCategory>(`/${orgSlug}/settings/event-categories`, data),

  updateEventCategory: (
    orgSlug: string,
    categoryId: string,
    data: { name?: string; color?: string; sortOrder?: number },
  ) => apiClient.patch<EventCategory>(`/${orgSlug}/settings/event-categories/${categoryId}`, data),

  deleteEventCategory: (orgSlug: string, categoryId: string) =>
    apiClient.delete(`/${orgSlug}/settings/event-categories/${categoryId}`),

  getVisitorWebhookToken: (orgSlug: string) =>
    apiClient.get<VisitorWebhookSettings>(`/${orgSlug}/settings/visitor-webhook`),

  regenerateVisitorWebhookToken: (orgSlug: string) =>
    apiClient.post<VisitorWebhookSettings>(`/${orgSlug}/settings/visitor-webhook/regenerate`, {}),

  getVisitorIntroTemplate: (orgSlug: string) =>
    apiClient.get<VisitorIntroTemplate>(`/${orgSlug}/settings/visitor-intro-template`),

  updateVisitorIntroTemplate: (orgSlug: string, data: VisitorIntroTemplate) =>
    apiClient.patch<VisitorIntroTemplate>(`/${orgSlug}/settings/visitor-intro-template`, data),
};
