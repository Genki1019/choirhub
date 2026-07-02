"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Users, User, Globe, EyeOff } from "lucide-react";
import { ticketsApi, type RaceData } from "@/lib/tickets-api";
import { ApiClientError } from "@/lib/api-client";
import { PartCard } from "./_components/PartCard";
import { IndividualTable } from "./_components/IndividualTable";
import { ScoringRules } from "./_components/ScoringRules";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function RacePage() {
  const { org, concertId } = useParams<{ org: string; concertId: string }>();
  const router = useRouter();

  const [data,       setData]       = useState<RaceData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [tab,        setTab]        = useState<"parts" | "individuals">("parts");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    ticketsApi.race(org, concertId)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, concertId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error ?? "データが見つかりません"}</span>
        </div>
      </div>
    );
  }

  const backHref = data.isTicketManager
    ? `/${org}/tickets/${concertId}`
    : `/${org}/tickets/${concertId}/my`;

  if (data.individuals.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <header className="bg-white border-b border-gray-200 shrink-0">
          <PageBleedRow className="flex items-center gap-4 py-4">
            <Link href={backHref} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-gray-800">チケットレース</h1>
          </PageBleedRow>
        </header>
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm text-gray-400">まだ配布・販売データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center gap-4 py-4">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">チケットレース</h1>
            <p className="text-sm text-gray-400">{data.concert.title}</p>
          </div>

          {data.isTicketManager && (
            data.racePublishedAt ? (
              <button
                onClick={async () => {
                  setPublishing(true);
                  try {
                    await ticketsApi.unpublishRace(org, concertId);
                    setData((prev) => prev ? { ...prev, racePublishedAt: null } : prev);
                  } finally { setPublishing(false); }
                }}
                disabled={publishing}
                className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-60"
              >
                {publishing ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
                公開取消
              </button>
            ) : (
              <button
                onClick={async () => {
                  setPublishing(true);
                  try {
                    const result = await ticketsApi.publishRace(org, concertId);
                    setData((prev) => prev ? { ...prev, racePublishedAt: result.racePublishedAt } : prev);
                  } finally { setPublishing(false); }
                }}
                disabled={publishing}
                className="flex items-center gap-1.5 text-sm text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-60"
              >
                {publishing ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                全体に公開
              </button>
            )
          )}
        </PageBleedRow>

        {data.racePublishedAt && (
          <PageBleedRow className="pb-2">
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Globe size={12} />
              {new Date(data.racePublishedAt).toLocaleDateString("ja-JP")} に全団員へ公開済み
            </div>
          </PageBleedRow>
        )}

        <PageBleedRow className="flex pt-1">
          {[
            { key: "parts"       as const, label: "パート順位", icon: Users },
            { key: "individuals" as const, label: "個人順位",   icon: User },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                tab === key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </PageBleedRow>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-6 max-w-2xl mx-auto w-full space-y-4">
        <ScoringRules scoring={data.scoring} />

        {tab === "parts" ? (
          <div className="space-y-3">
            {data.parts.map((p) => (
              <PartCard key={p.partId} part={p} scoring={data.scoring} />
            ))}
          </div>
        ) : (
          <IndividualTable individuals={data.individuals} />
        )}
      </main>
    </div>
  );
}
