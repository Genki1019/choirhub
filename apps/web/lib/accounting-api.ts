import { apiClient } from "./api-client";

export type PaymentMethod = "cash" | "paypay" | "bank_transfer" | "other";
export type CollectionPaymentStatus = "pending" | "paid" | "waived";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:          "現金",
  paypay:        "PayPay",
  bank_transfer: "振込",
  other:         "その他",
};

// ────────────────────────────
// 収支サマリー
// ────────────────────────────

export interface FinanceSummary {
  year: number;
  totalExpense: number;
  totalCollected: number;
  totalPending: number;
  balance: number;
  expenseByCategory: { categoryId: string; name: string; total: number }[];
}

// ────────────────────────────
// 支出
// ────────────────────────────

export interface ExpenseItem {
  id: string;
  category: { id: string; name: string };
  title: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  eventId: string | null;
  note: string | null;
  createdAt: string;
}

export interface ExpenseInput {
  categoryId: string;
  title: string;
  amount: number;
  paymentMethod?: PaymentMethod | null;
  paidAt?: string | null;
  eventId?: string | null;
  note?: string | null;
}

// ────────────────────────────
// 徴収
// ────────────────────────────

export interface CollectionSummaryItem {
  id: string;
  title: string;
  amount: number;
  dueDate: string | null;
  eventId: string | null;
  yearMonth: string | null;
  note: string | null;
  createdAt: string;
  summary: {
    total: number;
    paid: number;
    pending: number;
    waived: number;
    paidAmount: number;
  };
}

export interface CollectionPaymentItem {
  id: string;
  member: { id: string; nameJa: string; part: { id: string; name: string; voiceType: string; sortOrder: number } | null; memberTypeFee: number | null };
  status: CollectionPaymentStatus;
  amount: number | null;
  paidAt: string | null;
  method: PaymentMethod | null;
  note: string | null;
}

export interface CollectionDetail {
  id: string;
  title: string;
  amount: number;
  dueDate: string | null;
  eventId: string | null;
  yearMonth: string | null;
  note: string | null;
  createdAt: string;
  payments: CollectionPaymentItem[];
}

export interface CollectionInput {
  title: string;
  amount: number;
  dueDate?: string | null;
  eventId?: string | null;
  yearMonth?: string | null;
  note?: string | null;
  memberIds?: string[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  sortOrder: number;
}

// ────────────────────────────
// API
// ────────────────────────────

export const accountingApi = {
  summary: (orgSlug: string, year?: number) =>
    apiClient.get<FinanceSummary>(`/${orgSlug}/finance/summary${year ? `?year=${year}` : ""}`),

  // 支出
  listExpenses: (orgSlug: string, params?: { from?: string; to?: string; categoryId?: string }) => {
    const q = new URLSearchParams();
    if (params?.from)       q.set("from", params.from);
    if (params?.to)         q.set("to", params.to);
    if (params?.categoryId) q.set("categoryId", params.categoryId);
    const qs = q.toString();
    return apiClient.get<ExpenseItem[]>(`/${orgSlug}/finance/expenses${qs ? `?${qs}` : ""}`);
  },

  createExpense: (orgSlug: string, data: ExpenseInput) =>
    apiClient.post<ExpenseItem>(`/${orgSlug}/finance/expenses`, data),

  updateExpense: (orgSlug: string, expenseId: string, data: Partial<ExpenseInput>) =>
    apiClient.patch<ExpenseItem>(`/${orgSlug}/finance/expenses/${expenseId}`, data),

  deleteExpense: (orgSlug: string, expenseId: string) =>
    apiClient.delete(`/${orgSlug}/finance/expenses/${expenseId}`),

  // 徴収
  listCollections: (orgSlug: string, params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to)   q.set("to",   params.to);
    const qs = q.toString();
    return apiClient.get<CollectionSummaryItem[]>(`/${orgSlug}/finance/collections${qs ? `?${qs}` : ""}`);
  },

  createCollection: (orgSlug: string, data: CollectionInput) =>
    apiClient.post<{ id: string; title: string; amount: number }>(`/${orgSlug}/finance/collections`, data),

  getCollection: (orgSlug: string, collectionId: string) =>
    apiClient.get<CollectionDetail>(`/${orgSlug}/finance/collections/${collectionId}`),

  updateCollection: (orgSlug: string, collectionId: string, data: Partial<Omit<CollectionInput, "memberIds">>) =>
    apiClient.patch<{ id: string; title: string; amount: number }>(`/${orgSlug}/finance/collections/${collectionId}`, data),

  deleteCollection: (orgSlug: string, collectionId: string) =>
    apiClient.delete(`/${orgSlug}/finance/collections/${collectionId}`),

  // 支払い記録
  recordPayment: (
    orgSlug: string,
    collectionId: string,
    memberId: string,
    data: { status: CollectionPaymentStatus; amount?: number | null; paidAt?: string | null; method?: PaymentMethod | null; note?: string | null },
  ) => apiClient.patch<CollectionPaymentItem>(`/${orgSlug}/finance/collections/${collectionId}/payments/${memberId}`, data),

  bulkRecordPayment: (
    orgSlug: string,
    collectionId: string,
    data: { memberIds: string[]; status: CollectionPaymentStatus; paidAt?: string | null; method?: PaymentMethod | null },
  ) => apiClient.post<{ updated: number }>(`/${orgSlug}/finance/collections/${collectionId}/payments/bulk`, data),

  // カテゴリ
  listCategories: (orgSlug: string) =>
    apiClient.get<ExpenseCategory[]>(`/${orgSlug}/settings/expense-categories`),
};
