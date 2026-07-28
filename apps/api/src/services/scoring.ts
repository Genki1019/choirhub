import { z } from "zod";

const pointsSchema = z.array(z.number().int().min(0)).min(1).max(10);

const criterionSchema = z.object({ enabled: z.boolean(), points: pointsSchema });
const speedCriterionSchema = criterionSchema.extend({
  threshold: z.number().int().min(1),
  minCount: z.number().int().min(1),
});

export const scoringConfigInputSchema = z.object({
  avgSales: criterionSchema,
  speed5: speedCriterionSchema,
  speed10: speedCriterionSchema,
  zeroRatio: criterionSchema,
  outreach: criterionSchema,
});

export type ScoringConfig = z.infer<typeof scoringConfigInputSchema>;
type CriterionKey = keyof ScoringConfig;

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  avgSales: { enabled: true, points: [10, 8, 6, 4] },
  speed5: { enabled: true, points: [5, 4, 3, 2], threshold: 5, minCount: 3 },
  speed10: { enabled: true, points: [5, 4, 3, 2], threshold: 10, minCount: 3 },
  zeroRatio: { enabled: true, points: [4, 3, 2, 1] },
  outreach: { enabled: true, points: [5, 4, 3, 2] },
};

const SCORING_LABELS: Record<CriterionKey, string> = {
  avgSales: "平均販売枚数",
  speed5: "速さ（5枚×3名）",
  speed10: "速さ（10枚×3名）",
  zeroRatio: "ゼロ販売割合（少順）",
  outreach: "情宣回数",
};

// DBの scoringConfig は PATCH /scoring からのみ書き込まれ、常に完全なオブジェクトが入る前提。
// 未設定・破損データは安全側（デフォルト値）にフォールバックする。
export function resolveScoringConfig(raw: unknown): ScoringConfig {
  if (raw == null) return DEFAULT_SCORING_CONFIG;
  const parsed = scoringConfigInputSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SCORING_CONFIG;
}

export function withLabels(config: ScoringConfig) {
  return {
    avgSales: { label: SCORING_LABELS.avgSales, ...config.avgSales },
    speed5: { label: SCORING_LABELS.speed5, ...config.speed5 },
    speed10: { label: SCORING_LABELS.speed10, ...config.speed10 },
    zeroRatio: { label: SCORING_LABELS.zeroRatio, ...config.zeroRatio },
    outreach: { label: SCORING_LABELS.outreach, ...config.outreach },
  };
}

// ランクに基づきポイント付与（同率タイは平均点）
export function assignRankedPoints(
  items: Array<{ key: string; value: number }>,
  points: number[],
  higherIsBetter = true,
): Map<string, number> {
  const result = new Map<string, number>(items.map((i) => [i.key, 0]));
  if (!items.length) return result;
  const sorted = [...items].sort((a, b) =>
    higherIsBetter ? b.value - a.value : a.value - b.value,
  );
  let i = 0;
  while (i < sorted.length) {
    const cur = sorted[i].value;
    let j = i;
    while (j < sorted.length && sorted[j].value === cur) j++;
    const tiedPts = points.slice(i, j);
    const avg = tiedPts.length
      ? Math.round(tiedPts.reduce((s, p) => s + p, 0) / tiedPts.length)
      : 0;
    for (let k = i; k < j; k++) result.set(sorted[k].key, avg);
    i = j;
  }
  return result;
}

// 速さマイルストーン計算（minCount人目がthresholdに達した日時）
function speedMilestoneTime(
  members: Array<{ sold: number; reportedAt: Date | null }>,
  threshold: number,
  minCount: number,
): number | null {
  const eligible = members
    .filter((m) => m.sold >= threshold && m.reportedAt)
    .sort((a, b) => a.reportedAt!.getTime() - b.reportedAt!.getTime());
  if (eligible.length < minCount) return null;
  return eligible[minCount - 1].reportedAt!.getTime();
}

export interface PartScoreMember {
  sold: number;
  outreachCount: number;
  reportedAt: Date | null;
}

export interface PartScoreInput {
  partId: string;
  partName: string;
  members: PartScoreMember[];
}

export interface PartScoreResult {
  partId: string;
  partName: string;
  totalPoints: number;
  breakdown: {
    avgSalesPoints: number;
    speed5Points: number;
    speed10Points: number;
    zeroRatioPoints: number;
    outreachPoints: number;
  };
  speed5AchievedAt: number | null;
  speed10AchievedAt: number | null;
}

const CRITERIA = [
  {
    key: "avgSales",
    breakdownKey: "avgSalesPoints",
    higherIsBetter: true,
    value: (p: PartScoreInput) =>
      p.members.length ? p.members.reduce((s, m) => s + m.sold, 0) / p.members.length : 0,
  },
  {
    key: "speed5",
    breakdownKey: "speed5Points",
    higherIsBetter: false,
    value: (p: PartScoreInput, config: ScoringConfig) =>
      speedMilestoneTime(p.members, config.speed5.threshold, config.speed5.minCount),
  },
  {
    key: "speed10",
    breakdownKey: "speed10Points",
    higherIsBetter: false,
    value: (p: PartScoreInput, config: ScoringConfig) =>
      speedMilestoneTime(p.members, config.speed10.threshold, config.speed10.minCount),
  },
  {
    key: "zeroRatio",
    breakdownKey: "zeroRatioPoints",
    higherIsBetter: false,
    value: (p: PartScoreInput) =>
      p.members.length ? p.members.filter((m) => m.sold === 0).length / p.members.length : 1,
  },
  {
    key: "outreach",
    breakdownKey: "outreachPoints",
    higherIsBetter: true,
    value: (p: PartScoreInput) => p.members.reduce((s, m) => s + m.outreachCount, 0),
  },
] as const satisfies ReadonlyArray<{
  key: CriterionKey;
  breakdownKey: keyof PartScoreResult["breakdown"];
  higherIsBetter: boolean;
  value: (p: PartScoreInput, config: ScoringConfig) => number | null;
}>;

export function computePartScores(
  parts: PartScoreInput[],
  config: ScoringConfig,
): PartScoreResult[] {
  const pointsByCriterion = new Map<CriterionKey, Map<string, number>>();
  const rawValues = new Map<CriterionKey, Map<string, number | null>>();

  for (const c of CRITERIA) {
    const cfg = config[c.key];
    const items = parts.map((p) => ({ key: p.partId, value: c.value(p, config) }));
    rawValues.set(c.key, new Map(items.map((i) => [i.key, i.value])));

    const rankable = items.filter((i): i is { key: string; value: number } => i.value !== null);
    pointsByCriterion.set(
      c.key,
      cfg.enabled ? assignRankedPoints(rankable, cfg.points, c.higherIsBetter) : new Map(),
    );
  }

  return parts.map((p) => {
    const breakdown = Object.fromEntries(
      CRITERIA.map((c) => [c.breakdownKey, pointsByCriterion.get(c.key)!.get(p.partId) ?? 0]),
    ) as PartScoreResult["breakdown"];
    const totalPoints = Object.values(breakdown).reduce((s, v) => s + v, 0);
    return {
      partId: p.partId,
      partName: p.partName,
      totalPoints,
      breakdown,
      speed5AchievedAt: rawValues.get("speed5")!.get(p.partId) ?? null,
      speed10AchievedAt: rawValues.get("speed10")!.get(p.partId) ?? null,
    };
  });
}
