"use client";

import { useParams } from "next/navigation";
import { Ticket, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ticketsApi } from "@/lib/tickets-api";
import { ApiClientError } from "@/lib/api-client";
import { ticketKeys } from "@/lib/query-keys";
import { ManagerConcertCard } from "./_components/ManagerConcertCard";
import { MyConcertCard } from "./_components/MyConcertCard";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function TicketsPage() {
  const { org } = useParams<{ org: string }>();

  const { data: managerData, error: managerError, isLoading: loadingManager } = useQuery({
    queryKey: ticketKeys.list(org),
    queryFn:  () => ticketsApi.list(org),
    retry:    (_, err) => !(err instanceof ApiClientError && err.status === 403),
  });

  const isForbidden = managerError instanceof ApiClientError && managerError.status === 403;

  const { data: memberData, isLoading: loadingMember } = useQuery({
    queryKey: ticketKeys.myList(org),
    queryFn:  () => ticketsApi.myList(org),
    enabled:  isForbidden,
  });

  const loading = loadingManager || (isForbidden && loadingMember);

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center justify-between py-4">
          <h1 className="text-lg font-semibold text-gray-800">チケット</h1>
        </PageBleedRow>
      </header>

      <PageMain className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!loading && !isForbidden && managerError && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} />
            <span className="text-sm">{managerError.message}</span>
          </div>
        )}

        {!loading && isForbidden && (!memberData || memberData.length === 0) && (
          <div className="text-center py-16 text-gray-400">
            <Ticket size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">チケットが配布されていません</p>
          </div>
        )}

        {!loading && !isForbidden && managerData?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Ticket size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">演奏会が登録されていません</p>
          </div>
        )}

        {!isForbidden && managerData?.map((item) => (
          <ManagerConcertCard key={item.concertId} item={item} org={org} />
        ))}

        {isForbidden && memberData?.map((item) => (
          <MyConcertCard key={item.concertId} item={item} org={org} />
        ))}
      </PageMain>
    </div>
  );
}
