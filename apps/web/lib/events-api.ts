import { apiClient } from "./api-client";

export type AttendanceStatus = "attending" | "absent" | "maybe" | "undecided";

export interface EventCategory {
  id: string;
  name: string;
  slug: string | null;
  color: string;
  sortOrder: number;
}

export interface EventSummary {
  id: string;
  title: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  location: string | null;
  locationUrl: string | null;
  deadline: string | null;
  pageMemo: string | null;
  isLocked: boolean;
  targetRoles: string[] | null;
  targetPartIds: string[] | null;
  myAttendance: AttendanceStatus;
  concertId: string | null;
}

export interface AttendancePartSummary {
  id: string;
  name: string;
  sortOrder: number;
  voiceType: string;
}

export interface AttendanceMember {
  id: string;
  nameJa: string;
  part: AttendancePartSummary | null;
}

export interface AttendanceRecord {
  member: AttendanceMember;
  status: AttendanceStatus;
  arriveTime: string | null;
  leaveTime: string | null;
  dayMemo: string | null;
}

export interface AttendanceSummary {
  attending: number;
  absent: number;
  maybe: number;
  undecided: number;
}

export interface EventDetail extends Omit<EventSummary, "myAttendance"> {
  invitedCount: number;
  attendances: AttendanceRecord[];
  summary: AttendanceSummary;
}

export interface CreateEventInput {
  title: string;
  categoryId: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  locationUrl?: string | null;
  deadline?: string | null;
  pageMemo?: string | null;
  targetRoles?: string[] | null;
  targetPartIds?: string[] | null;
}

export const eventsApi = {
  list: (orgSlug: string, params?: { from?: string; to?: string; type?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to)   q.set("to",   params.to);
    if (params?.type) q.set("type", params.type);
    const qs = q.toString();
    return apiClient.get<EventSummary[]>(`/${orgSlug}/events${qs ? `?${qs}` : ""}`);
  },

  get: (orgSlug: string, id: string) =>
    apiClient.get<EventDetail>(`/${orgSlug}/events/${id}`),

  create: (orgSlug: string, body: CreateEventInput) =>
    apiClient.post<EventSummary>(`/${orgSlug}/events`, body),

  update: (orgSlug: string, id: string, body: Partial<CreateEventInput>) =>
    apiClient.patch<EventSummary>(`/${orgSlug}/events/${id}`, body),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete(`/${orgSlug}/events/${id}`),

  updateAttendance: (
    orgSlug: string,
    eventId: string,
    body: {
      status: AttendanceStatus;
      arriveTime?: string | null;
      leaveTime?: string | null;
      dayMemo?: string | null;
    }
  ) =>
    apiClient.put<{ status: AttendanceStatus; arriveTime: string | null; leaveTime: string | null; dayMemo: string | null; updatedAt: string }>(
      `/${orgSlug}/events/${eventId}/attendance/me`,
      body
    ),
};
