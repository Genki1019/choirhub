"use client";

import { useParams } from "next/navigation";
import { Ticket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ticketsApi } from "@/lib/tickets-api";
import { ApiClientError, userErrorMessage } from "@/lib/api-client";
import { ticketKeys } from "@/lib/query-keys";
import { ManagerConcertCard } from "./_components/ManagerConcertCard";
import { MyConcertCard } from "./_components/MyConcertCard";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function TicketsPage() {
  const { org } = useParams<{ org: string }>();

  const {
    data: managerData,
    error: managerError,
    isLoading: loadingManager,
  } = useQuery({
    queryKey: ticketKeys.list(org),
    queryFn: () => ticketsApi.list(org),
    retry: (failureCount, err) =>
      !(err instanceof ApiClientError && err.status === 403) && failureCount < 3,
  });

  const isForbidden = managerError instanceof ApiClientError && managerError.status === 403;

  const {
    data: memberData,
    isLoading: loadingMember,
    error: memberError,
  } = useQuery({
    queryKey: ticketKeys.myList(org),
    queryFn: () => ticketsApi.myList(org),
    enabled: isForbidden,
  });

  const loading = loadingManager || (isForbidden && loadingMember);
  const listError = isForbidden ? memberError : managerError;

  return (
    <PageWithHeader title="チケット" loading={loading} mainClassName="space-y-3">
      <ErrorMessage variant="section">
        {listError &&
          userErrorMessage(
            listError,
            "チケット情報の読み込みに失敗しました。ページを再読み込みしてください。",
          )}
      </ErrorMessage>

      {isForbidden && !memberError && (!memberData || memberData.length === 0) && (
        <div className="py-16 text-center text-gray-400">
          <Ticket size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">チケットが配布されていません</p>
        </div>
      )}

      {!isForbidden && managerData?.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <Ticket size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">演奏会が登録されていません</p>
        </div>
      )}

      {!isForbidden &&
        managerData?.map((item) => (
          <ManagerConcertCard key={item.concertId} item={item} org={org} />
        ))}

      {isForbidden &&
        memberData?.map((item) => <MyConcertCard key={item.concertId} item={item} org={org} />)}
    </PageWithHeader>
  );
}
