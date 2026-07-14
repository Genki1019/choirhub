"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X } from "lucide-react";
import { concertsApi, type AddProgramInput, type ProgramDetail } from "@/lib/concerts-api";
import { scoresApi, type ScoreListItem } from "@/lib/scores-api";

interface AddProgramModalProps {
  orgSlug: string;
  concertId: string;
  stageId: string;
  onClose: () => void;
  onCreated: (program: ProgramDetail) => void;
}

export function AddProgramModal({
  orgSlug,
  concertId,
  stageId,
  onClose,
  onCreated,
}: AddProgramModalProps) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState<AddProgramInput>({ title: "", composer: "", arranger: "" });
  const [scores, setScores] = useState<ScoreListItem[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoreSearch, setScoreSearch] = useState("");
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filteredScores = scores.filter(
    (s) => s.title.includes(scoreSearch) || (s.composer?.includes(scoreSearch) ?? false),
  );

  const handleModeChange = (next: "new" | "existing") => {
    setMode(next);
    setError(null);
    if (next === "existing" && scores.length === 0) {
      setLoadingScores(true);
      scoresApi
        .list(orgSlug)
        .then(setScores)
        .catch(() => {})
        .finally(() => setLoadingScores(false));
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "new") {
        if (!form.title?.trim()) {
          setError("曲名を入力してください");
          return;
        }
        const created = await concertsApi.addProgram(orgSlug, concertId, stageId, {
          ...form,
          composer: form.composer || null,
          arranger: form.arranger || null,
        });
        onCreated(created);
      } else {
        if (!selectedScoreId) {
          setError("楽譜を選択してください");
          return;
        }
        const created = await concertsApi.addProgram(orgSlug, concertId, stageId, {
          scoreId: selectedScoreId,
        });
        onCreated(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-800">曲目を追加</h2>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          {(
            [
              ["new", "新しく作成"],
              ["existing", "既存から選ぶ"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
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

        <div className="space-y-4 px-6 py-5">
          {mode === "new" ? (
            <>
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
            </>
          ) : (
            <>
              <input
                value={scoreSearch}
                onChange={(e) => setScoreSearch(e.target.value)}
                placeholder="曲名・作曲者で検索..."
                className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                autoFocus
              />
              <div className="max-h-52 overflow-hidden overflow-y-auto rounded-lg border border-gray-200">
                {loadingScores ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">読み込み中...</span>
                  </div>
                ) : filteredScores.length === 0 ? (
                  <p className="py-8 text-center text-xs text-gray-400">楽譜が見つかりません</p>
                ) : (
                  filteredScores.map((score) => (
                    <button
                      key={score.id}
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
            </>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            追加する
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
