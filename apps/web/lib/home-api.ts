import { apiClient } from "./api-client";
import type { EventCardItem } from "./events-api";

export type HomeUpcomingEvent = EventCardItem;

export interface HomeRecentMail {
  id: string;
  subject: string;
  sentAt: string;
  senderName: string;
  senderAvatarUrl: string | null;
}

export interface HomeData {
  upcomingEvents: HomeUpcomingEvent[];
  nextRehearsal: HomeUpcomingEvent | null;
  nextConcert: HomeUpcomingEvent | null;
  unansweredEventCount: number;
  recentMails: HomeRecentMail[];
  canViewTickets: boolean;
  monthlyOrganizer: string | null;
  isTicketManager: boolean;
}

export const homeApi = {
  get: (org: string) => apiClient.get<HomeData>(`/${org}/home`),
  setMonthlyOrganizer: (org: string, partName: string | null) =>
    apiClient.patch<{ monthlyOrganizer: string | null }>(`/${org}/home/monthly-organizer`, {
      partName,
    }),
};
