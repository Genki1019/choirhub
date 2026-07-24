"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { concertsApi, type AddProgramInput } from "@/lib/concerts-api";
import { scoresApi } from "@/lib/scores-api";
import { ApiClientError } from "@/lib/api-client";
import { concertKeys, scoresKeys } from "@/lib/query-keys";
import { useMember } from "@/contexts/MemberContext";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageMain } from "@/components/PageMain";
import { PageHeader } from "@/components/PageHeader";

export default function NewProgramPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const stageId = searchParams.get("stageId") ?? "";
  const backHref = `/${org}/concerts/${id}?tab=stages`;

  const { roles } = useMember();
  const isAdmin = roles.includes("admin");

  const {
    data: concert,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: concertKeys.detail(org, id),
    queryFn: () => concertsApi.get(org, id),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (queryError instanceof ApiClientError && queryError.status === 404) {
      router.push(`/${org}/concerts`);
    }
  }, [queryError, org, router]);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState<AddProgramInput>({ title: "", composer: "", arranger: "" });
  const [scoreSearch, setScoreSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(scoreSearch), 300);
    return () => clearTimeout(timer);
  }, [scoreSearch]);

  const { data: scores = [], isFetching: loadingScores } = useQuery({
    queryKey: scoresKeys.list(org, debouncedSearch),
    queryFn: () => scoresApi.list(org, { q: debouncedSearch }),
    enabled: mode === "existing",
  });

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <NotFoundPage message="このページにアクセスする権限がありません" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (queryError || !concert) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{queryError?.message ?? "演奏会が見つかりません"}</span>
        </div>
      </div>
    );
  }

  const stage = concert.stages.find((s) => s.id === stageId);
  if (!stage) {
    return (
      <div className="flex h-full flex-col">
        <NotFoundPage message="ステージが見つかりません" />
      </div>
    );
  }

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "new") {
        if (!form.title?.trim()) {
          setError("曲名を入力してください");
          return;
        }
        await concertsApi.addProgram(org, id, stageId, {
          ...form,
          composer: form.composer || null,
          arranger: form.arranger || null,
        });
      } else {
        if (!selectedScoreId) {
          setError("楽譜を選択してください");
          return;
        }
        await concertsApi.addProgram(org, id, stageId, { scoreId: selectedScoreId });
      }
      await queryClient.invalidateQueries({ queryKey: concertKeys.detail(org, id) });
      router.push(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="曲目を追加" subtitle={stage.name} backHref={backHref} />

      <PageMain>
        <div className="mx-auto max-w-sm space-y-4">
          <div className="flex rounded-xl border border-gray-200 bg-white">
            {(
              [
                ["new", "新しく作成"],
                ["existing", "既存から選ぶ"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={[
                  "flex-1 py-2.5 text-xs font-medium transition-colors",
                  mode === m
                    ? "border-brand-500 text-brand-600 border-b-2"
                    : "text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "new" ? (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  曲名 <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.title ?? ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例: 男声合唱のための「風と光」"
                  className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">作曲者</label>
                  <input
                    value={form.composer ?? ""}
                    onChange={(e) => setForm({ ...form, composer: e.target.value })}
                    placeholder="例: 山田 花子"
                    className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">編曲者</label>
                  <input
                    value={form.arranger ?? ""}
                    onChange={(e) => setForm({ ...form, arranger: e.target.value })}
                    placeholder="例: 田中 二郎"
                    className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
              <input
                value={scoreSearch}
                onChange={(e) => setScoreSearch(e.target.value)}
                placeholder="曲名・作曲者・編曲者で検索..."
                className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                autoFocus
              />
              <div className="max-h-80 overflow-hidden overflow-y-auto rounded-lg border border-gray-200">
                {loadingScores ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">読み込み中...</span>
                  </div>
                ) : scores.length === 0 ? (
                  <p className="py-8 text-center text-xs text-gray-400">楽譜が見つかりません</p>
                ) : (
                  scores.map((score) => (
                    <button
                      key={score.id}
                      type="button"
                      onClick={() => setSelectedScoreId(score.id)}
                      className={[
                        "w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0",
                        selectedScoreId === score.id ? "bg-brand-50" : "hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <p className="text-sm font-medium text-gray-800">{score.title}</p>
                      {(score.composer || score.arranger) && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {[
                            score.composer && `${score.composer} 作曲`,
                            score.arranger && `${score.arranger} 編曲`,
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pb-8">
            <Link
              href={backHref}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              追加する
            </button>
          </div>
        </div>
      </PageMain>
    </div>
  );
}
