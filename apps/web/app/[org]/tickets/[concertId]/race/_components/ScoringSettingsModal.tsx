"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SCORING_CRITERIA } from "@/lib/scoring-criteria";
import type { RaceScoringConfig, ScoringConfigInput } from "@/lib/tickets-api";

interface CriterionForm {
  enabled: boolean;
  pointsStr: string;
  thresholdStr: string;
  minCountStr: string;
}

type FormState = Record<(typeof SCORING_CRITERIA)[number]["key"], CriterionForm>;

function toFormState(scoring: RaceScoringConfig): FormState {
  return Object.fromEntries(
    SCORING_CRITERIA.map((c) => {
      const cfg = scoring[c.key];
      return [
        c.key,
        {
          enabled: cfg.enabled,
          pointsStr: cfg.points.join(", "),
          thresholdStr: "threshold" in cfg ? String(cfg.threshold) : "",
          minCountStr: "minCount" in cfg ? String(cfg.minCount) : "",
        },
      ];
    }),
  ) as FormState;
}

function parsePoints(pointsStr: string): number[] | null {
  const points = pointsStr
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map(Number);
  if (
    points.length === 0 ||
    points.length > 10 ||
    points.some((p) => !Number.isInteger(p) || p < 0)
  )
    return null;
  return points;
}

function buildPayload(form: FormState): ScoringConfigInput | null {
  const parsed: Record<string, { enabled: boolean; points: number[] } | null> = {};
  for (const c of SCORING_CRITERIA) {
    const points = parsePoints(form[c.key].pointsStr);
    parsed[c.key] = points ? { enabled: form[c.key].enabled, points } : null;
  }
  if (Object.values(parsed).some((v) => v === null)) return null;

  const speed5Threshold = Number(form.speed5.thresholdStr);
  const speed5MinCount = Number(form.speed5.minCountStr);
  const speed10Threshold = Number(form.speed10.thresholdStr);
  const speed10MinCount = Number(form.speed10.minCountStr);
  if (
    !Number.isInteger(speed5Threshold) ||
    speed5Threshold < 1 ||
    !Number.isInteger(speed5MinCount) ||
    speed5MinCount < 1 ||
    !Number.isInteger(speed10Threshold) ||
    speed10Threshold < 1 ||
    !Number.isInteger(speed10MinCount) ||
    speed10MinCount < 1
  ) {
    return null;
  }

  return {
    avgSales: parsed.avgSales!,
    speed5: { ...parsed.speed5!, threshold: speed5Threshold, minCount: speed5MinCount },
    speed10: { ...parsed.speed10!, threshold: speed10Threshold, minCount: speed10MinCount },
    zeroRatio: parsed.zeroRatio!,
    outreach: parsed.outreach!,
  };
}

interface ScoringSettingsModalProps {
  initialScoring: RaceScoringConfig;
  onSubmit: (config: ScoringConfigInput) => Promise<void>;
  onClose: () => void;
}

export function ScoringSettingsModal({
  initialScoring,
  onSubmit,
  onClose,
}: ScoringSettingsModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialScoring));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCriterion = (key: keyof FormState, patch: Partial<CriterionForm>) =>
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload(form);
    if (!payload) {
      setError("配点は10個以内のカンマ区切りの整数で、閾値・人数は1以上の整数で入力してください");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-gray-800">採点設定</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {SCORING_CRITERIA.map((c) => {
            const cfg = form[c.key];
            return (
              <div key={c.key} className="rounded-xl border border-gray-100 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) => updateCriterion(c.key, { enabled: e.target.checked })}
                  />
                  {initialScoring[c.key].label}
                </label>
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">配点（カンマ区切り）</label>
                    <input
                      type="text"
                      value={cfg.pointsStr}
                      onChange={(e) => updateCriterion(c.key, { pointsStr: e.target.value })}
                      placeholder="5, 4, 3, 2"
                      className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
                    />
                  </div>
                  {c.hasSpeedFields && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">枚数閾値</label>
                        <input
                          type="number"
                          min={1}
                          value={cfg.thresholdStr}
                          onChange={(e) => updateCriterion(c.key, { thresholdStr: e.target.value })}
                          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">最低人数</label>
                        <input
                          type="number"
                          min={1}
                          value={cfg.minCountStr}
                          onChange={(e) => updateCriterion(c.key, { minCountStr: e.target.value })}
                          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
