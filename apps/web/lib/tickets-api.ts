import { apiClient } from "./api-client";

export interface TicketConcertSummary {
  concertId: string;
  title: string;
  heldOn: string;
  status: string;
  batchCount: number;
  totalAllocated: number;
  totalSold: number;
  soldRate: number;
  collectedCount: number;
  memberCount: number;
}

export interface AllocationRow {
  id: string;
  batchId: string;
  memberId: string;
  requestedCount: number | null;
  nameJa: string;
  partId: string | null;
  partName: string | null;
  partSortOrder: number;
  partVoiceType: string;
  allocatedCount: number;
  soldAdult: number;
  soldStudent: number;
  soldOther: number;
  returnedCount: number;
  outreachCount: number;
  isOutreachExpensePaid: boolean;
  outreachExpensePaidAt: string | null;
  isCollected: boolean;
  reportedAt: string | null;
}

export interface BatchDetail {
  id: string;
  name: string;
  price: number;
  priceStudent: number | null;
  totalCount: number;
  saleStart: string | null;
  saleEnd: string | null;
  allocations: AllocationRow[];
}

export interface PartSummaryRow {
  partId: string;
  partName: string;
  allocated: number;
  sold: number;
  rate: number;
}

export interface TicketDetail {
  concert: { id: string; title: string; heldOn: string; ticketInputClosedAt: string | null; outreachExpensePerTrip: number | null };
  isAdmin: boolean;
  myMemberId: string;
  batches: BatchDetail[];
  partSummary: PartSummaryRow[];
}

export interface RaceScoringConfig {
  avgSales:  { label: string; points: number[] };
  speed5:    { label: string; threshold: number; minCount: number; points: number[] };
  speed10:   { label: string; threshold: number; minCount: number; points: number[] };
  zeroRatio: { label: string; points: number[] };
  outreach:  { label: string; points: number[] };
}

export interface RacePartBreakdown {
  avgSalesPoints: number;
  speed5Points: number;
  speed10Points: number;
  zeroRatioPoints: number;
  outreachPoints: number;
}

export interface RacePartStats {
  avgSold: number;
  speed5AchievedAt: string | null;
  speed10AchievedAt: string | null;
  zeroSellerRatio: number;
  totalOutreach: number;
  memberCount: number;
  allocated: number;
  sold: number;
}

export interface RacePart {
  partId: string;
  partName: string;
  rank: number;
  totalPoints: number;
  breakdown: RacePartBreakdown;
  stats: RacePartStats;
}

export interface RaceIndividual {
  memberId: string;
  nameJa: string;
  partId: string | null;
  partName: string | null;
  allocated: number;
  sold: number;
  outreachCount: number;
  rate: number;
  rank: number;
}

export interface RaceData {
  concert: { id: string; title: string };
  isTicketManager: boolean;
  racePublishedAt: string | null;
  scoring: RaceScoringConfig;
  parts: RacePart[];
  individuals: RaceIndividual[];
}

export interface UpdateAllocationInput {
  allocatedCount?: number;
  soldAdult?: number;
  soldStudent?: number;
  soldOther?: number;
  returnedCount?: number;
  outreachCount?: number;
  isOutreachExpensePaid?: boolean;
  isCollected?: boolean;
}

export interface MyAllocationBatch {
  allocationId: string;
  batchId: string;
  batchName: string;
  price: number;
  priceStudent: number | null;
  allocatedCount: number;
  requestedCount: number | null;
  soldAdult: number;
  soldStudent: number;
  soldOther: number;
  returnedCount: number;
  outreachCount: number;
  reportedAt: string | null;
}

export interface MyAllocationConcert {
  concertId: string;
  title: string;
  heldOn: string;
  racePublishedAt: string | null;
  ticketInputClosedAt: string | null;
  batches: MyAllocationBatch[];
}

export interface CreateBatchInput {
  name: string;
  price: number;
  priceStudent?: number | null;
  totalCount: number;
  saleStart?: string | null;
  saleEnd?: string | null;
}

export interface UpdateBatchInput {
  name?: string;
  price?: number;
  priceStudent?: number | null;
  totalCount?: number;
  saleStart?: string | null;
  saleEnd?: string | null;
}

export interface AllocateInput {
  batchId: string;
  memberId?: string;
  allocatedCount: number;
}

export interface AllocateResult {
  id: string;
  batchId: string;
  memberId: string;
  allocatedCount: number;
  requestedCount: number | null;
}

export interface OutreachParticipantRow {
  id: string;
  memberId: string;
  memberName: string;
  partId: string | null;
  partName: string | null;
  ticketsSold: number;
  expense: number | null;
}

export interface OutreachActivityRow {
  id: string;
  concertId: string;
  destination: string;
  activityDate: string;
  note: string | null;
  status: "pending" | "paid";
  paidAt: string | null;
  createdById: string;
  creatorName: string;
  createdAt: string;
  participants: OutreachParticipantRow[];
}

export interface CreateOutreachActivityInput {
  destination: string;
  activityDate: string;
  note?: string;
  participants: {
    memberId: string;
    ticketsSold: number;
    expense?: number;
  }[];
}

export const ticketsApi = {
  list: (orgSlug: string) =>
    apiClient.get<TicketConcertSummary[]>(`/${orgSlug}/tickets`),

  get: (orgSlug: string, concertId: string) =>
    apiClient.get<TicketDetail>(`/${orgSlug}/tickets/${concertId}`),

  myList: (orgSlug: string) =>
    apiClient.get<MyAllocationConcert[]>(`/${orgSlug}/tickets/my`),

  createBatch: (orgSlug: string, concertId: string, data: CreateBatchInput) =>
    apiClient.post<BatchDetail>(`/${orgSlug}/tickets/${concertId}/batches`, data),

  updateBatch: (orgSlug: string, concertId: string, batchId: string, data: UpdateBatchInput) =>
    apiClient.patch<Omit<BatchDetail, "allocations">>(`/${orgSlug}/tickets/${concertId}/batches/${batchId}`, data),

  deleteBatch: (orgSlug: string, concertId: string, batchId: string) =>
    apiClient.delete(`/${orgSlug}/tickets/${concertId}/batches/${batchId}`),

  allocate: (orgSlug: string, concertId: string, data: AllocateInput) =>
    apiClient.post<AllocateResult>(`/${orgSlug}/tickets/${concertId}/allocate`, data),

  updateAllocation: (orgSlug: string, allocationId: string, data: UpdateAllocationInput) =>
    apiClient.patch<AllocationRow>(`/${orgSlug}/tickets/allocations/${allocationId}`, data),

  race: (orgSlug: string, concertId: string) =>
    apiClient.get<RaceData>(`/${orgSlug}/tickets/${concertId}/race`),

  publishRace: (orgSlug: string, concertId: string) =>
    apiClient.post<{ racePublishedAt: string | null }>(`/${orgSlug}/tickets/${concertId}/race/publish`, {}),

  unpublishRace: (orgSlug: string, concertId: string) =>
    apiClient.delete(`/${orgSlug}/tickets/${concertId}/race/publish`),

  closeTicketInput: (orgSlug: string, concertId: string) =>
    apiClient.post<{ ticketInputClosedAt: string | null }>(`/${orgSlug}/tickets/${concertId}/close`, {}),

  reopenTicketInput: (orgSlug: string, concertId: string) =>
    apiClient.delete(`/${orgSlug}/tickets/${concertId}/close`),

  setOutreachExpenseRate: (orgSlug: string, concertId: string, outreachExpensePerTrip: number | null) =>
    apiClient.patch<{ outreachExpensePerTrip: number | null }>(`/${orgSlug}/tickets/${concertId}/outreach-expense-rate`, { outreachExpensePerTrip }),

  bulkOutreachExpense: (orgSlug: string, concertId: string, allocationIds: string[], paid: boolean) =>
    apiClient.post<{ updatedCount: number }>(`/${orgSlug}/tickets/${concertId}/outreach-expenses/bulk`, { allocationIds, paid }),

  listOutreachActivities: (orgSlug: string, concertId: string) =>
    apiClient.get<OutreachActivityRow[]>(`/${orgSlug}/tickets/${concertId}/outreach`),

  createOutreachActivity: (orgSlug: string, concertId: string, data: CreateOutreachActivityInput) =>
    apiClient.post<OutreachActivityRow>(`/${orgSlug}/tickets/${concertId}/outreach`, data),

  payOutreachActivity: (orgSlug: string, concertId: string, activityId: string) =>
    apiClient.patch<OutreachActivityRow>(`/${orgSlug}/tickets/${concertId}/outreach/${activityId}/pay`, {}),

  deleteOutreachActivity: (orgSlug: string, concertId: string, activityId: string) =>
    apiClient.delete(`/${orgSlug}/tickets/${concertId}/outreach/${activityId}`),
};
