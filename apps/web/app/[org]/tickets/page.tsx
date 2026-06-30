"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ticket, Loader2, AlertCircle } from "lucide-react";
import { ticketsApi, type TicketConcertSummary, type MyAllocationConcert } from "@/lib/tickets-api";
import { ApiClientError } from "@/lib/api-client";
import { ManagerConcertCard } from "./_components/ManagerConcertCard";
import { MyConcertCard } from "./_components/MyConcertCard";
import { PageMain } from "@/components/PageMain";

type ViewMode = "loading" | "manager" | "member" | "empty" | "error";

export default function TicketsPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();

  const [mode,        setMode]        = useState<ViewMode>("loading");
  const [managerData, setManagerData] = useState<TicketConcertSummary[]>([]);
  const [memberData,  setMemberData]  = useState<MyAllocationConcert[]>([]);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  useEffect(() => {
    ticketsApi.list(org)
      .then((data) => {
        setManagerData(data);
        setMode("manager");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        if (err instanceof ApiClientError && err.status === 403) {
          ticketsApi.myList(org)
            .then((data) => {
              setMemberData(data);
              setMode(data.length === 0 ? "empty" : "member");
            })
            .catch(() => setMode("empty"));
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : "データの取得に失敗しました");
        setMode("error");
      });
  }, [org, router]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">チケット</h1>
      </header>

      <PageMain className="space-y-3">
        {mode === "loading" && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {mode === "error" && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} />
            <span className="text-sm">{errorMsg}</span>
          </div>
        )}

        {mode === "empty" && (
          <div className="text-center py-16 text-gray-400">
            <Ticket size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">チケットが配布されていません</p>
          </div>
        )}

        {mode === "manager" && managerData.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Ticket size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">演奏会が登録されていません</p>
          </div>
        )}

        {mode === "manager" && managerData.map((item) => (
          <ManagerConcertCard key={item.concertId} item={item} org={org} />
        ))}

        {mode === "member" && memberData.map((item) => (
          <MyConcertCard key={item.concertId} item={item} org={org} />
        ))}
      </PageMain>
    </div>
  );
}
