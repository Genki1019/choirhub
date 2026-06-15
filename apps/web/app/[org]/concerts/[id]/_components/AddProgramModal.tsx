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

export function AddProgramModal({ orgSlug, concertId, stageId, onClose, onCreated }: AddProgramModalProps) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState<AddProgramInput>({ title: "", composer: "", arranger: "" });
  const [scores, setScores] = useState<ScoreListItem[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoreSearch, setScoreSearch] = useState("");
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filteredScores = scores.filter((s) =>
    s.title.includes(scoreSearch) || (s.composer?.includes(scoreSearch) ?? false)
  );

  const handleModeChange = (next: "new" | "existing") => {
    setMode(next);
    setError(null);
    if (next === "existing" && scores.length === 0) {
      setLoadingScores(true);
      scoresApi.list(orgSlug).then(setScores).catch(() => {}).finally(() => setLoadingScores(false));
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "new") {
        if (!form.title?.trim()) { setError("曲名を入力してください"); return; }
        const created = await concertsApi.addProgram(orgSlug, concertId, stageId, {
          ...form,
          composer: form.composer || null,
          arranger: form.arranger || null,
        });
        onCreated(created);
      } else {
        if (!selectedScoreId) { setError("楽譜を選択してください"); return; }
        const created = await concertsApi.addProgram(orgSlug, concertId, stageId, { scoreId: selectedScoreId });
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">曲目を追加</h2>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          {([["new", "新しく作成"], ["existing", "既存から選ぶ"]] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={[
                "flex-1 py-2.5 text-xs font-medium transition-colors",
                mode === m ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {mode === "new" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  曲名 <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.title ?? ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例: 男声合唱のための「風と光」"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">作曲者</label>
                  <input
                    value={form.composer ?? ""}
                    onChange={(e) => setForm({ ...form, composer: e.target.value })}
                    placeholder="例: 山田 花子"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">編曲者</label>
                  <input
                    value={form.arranger ?? ""}
                    onChange={(e) => setForm({ ...form, arranger: e.target.value })}
                    placeholder="例: 田中 二郎"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                {loadingScores ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">読み込み中...</span>
                  </div>
                ) : filteredScores.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">楽譜が見つかりません</p>
                ) : (
                  filteredScores.map((score) => (
                    <button
                      key={score.id}
                      onClick={() => setSelectedScoreId(score.id)}
                      className={[
                        "w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors",
                        selectedScoreId === score.id ? "bg-blue-50" : "hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <p className="text-sm font-medium text-gray-800">{score.title}</p>
                      {(score.composer || score.arranger) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[score.composer && `${score.composer} 作曲`, score.arranger && `${score.arranger} 編曲`].filter(Boolean).join(" / ")}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            追加する
          </button>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
