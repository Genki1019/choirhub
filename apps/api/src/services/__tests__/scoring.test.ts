import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCORING_CONFIG,
  assignRankedPoints,
  computePartScores,
  resolveScoringConfig,
  withLabels,
  type PartScoreInput,
  type PartScoreMember,
  type ScoringConfig,
} from "../scoring.js";

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute));

const member = (
  sold: number,
  opts: { outreachCount?: number; reportedAt?: Date | null } = {},
): PartScoreMember => ({
  sold,
  outreachCount: opts.outreachCount ?? 0,
  reportedAt: opts.reportedAt ?? null,
});

const part = (partId: string, members: PartScoreMember[]): PartScoreInput => ({
  partId,
  partName: `${partId}パート`,
  members,
});

const byId = (results: ReturnType<typeof computePartScores>) =>
  Object.fromEntries(results.map((r) => [r.partId, r]));

describe("assignRankedPoints", () => {
  it("higherIsBetter=true: 値の大きい順に配点する", () => {
    const result = assignRankedPoints(
      [
        { key: "a", value: 1 },
        { key: "b", value: 3 },
        { key: "c", value: 2 },
      ],
      [10, 8, 6],
    );
    expect(Object.fromEntries(result)).toEqual({ a: 6, b: 10, c: 8 });
  });

  it("higherIsBetter=false: 値の小さい順に配点する", () => {
    const result = assignRankedPoints(
      [
        { key: "a", value: 1 },
        { key: "b", value: 3 },
        { key: "c", value: 2 },
      ],
      [10, 8, 6],
      false,
    );
    expect(Object.fromEntries(result)).toEqual({ a: 10, b: 6, c: 8 });
  });

  it("同率タイは該当順位の配点の平均を付与する", () => {
    const result = assignRankedPoints(
      [
        { key: "a", value: 5 },
        { key: "b", value: 5 },
        { key: "c", value: 1 },
      ],
      [10, 8, 6],
    );
    expect(Object.fromEntries(result)).toEqual({ a: 9, b: 9, c: 6 });
  });

  it("同率タイの平均点は四捨五入される", () => {
    const result = assignRankedPoints(
      [
        { key: "a", value: 5 },
        { key: "b", value: 5 },
      ],
      [5, 4],
    );
    expect(Object.fromEntries(result)).toEqual({ a: 5, b: 5 });
  });

  it("配点の数を超える順位は0点になる", () => {
    const result = assignRankedPoints(
      [
        { key: "a", value: 3 },
        { key: "b", value: 2 },
        { key: "c", value: 1 },
      ],
      [10, 8],
    );
    expect(Object.fromEntries(result)).toEqual({ a: 10, b: 8, c: 0 });
  });

  it("配点の数をまたぐ同率タイは配点のある順位のみで平均する", () => {
    const result = assignRankedPoints(
      [
        { key: "a", value: 3 },
        { key: "b", value: 2 },
        { key: "c", value: 2 },
      ],
      [10, 8],
    );
    expect(Object.fromEntries(result)).toEqual({ a: 10, b: 8, c: 8 });
  });

  it("空配列は空のMapを返す", () => {
    expect(assignRankedPoints([], [10, 8]).size).toBe(0);
  });
});

describe("computePartScores", () => {
  it("パートが0件なら空配列を返す", () => {
    expect(computePartScores([], DEFAULT_SCORING_CONFIG)).toEqual([]);
  });

  it("入力と同じ順序・件数で結果を返す", () => {
    const results = computePartScores(
      [part("b", [member(1)]), part("a", [member(2)]), part("", [member(0)])],
      DEFAULT_SCORING_CONFIG,
    );
    expect(results.map((r) => r.partId)).toEqual(["b", "a", ""]);
    expect(results[0].partName).toBe("bパート");
  });

  it("avgSales: 平均販売枚数の多い順に配点する", () => {
    const results = byId(
      computePartScores(
        [
          part("a", [member(10), member(10)]),
          part("b", [member(4), member(6)]),
          part("c", [member(0)]),
        ],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.a.breakdown.avgSalesPoints).toBe(10);
    expect(results.b.breakdown.avgSalesPoints).toBe(8);
    expect(results.c.breakdown.avgSalesPoints).toBe(6);
  });

  it("avgSales: 人数の異なるパートも合計ではなく平均で比較する", () => {
    const results = byId(
      computePartScores(
        [part("a", [member(3), member(3), member(3)]), part("b", [member(5)])],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.b.breakdown.avgSalesPoints).toBe(10);
    expect(results.a.breakdown.avgSalesPoints).toBe(8);
  });

  it("speed5: 報告日時順でminCount人目が5枚に到達した日時の早い順に配点する", () => {
    const results = byId(
      computePartScores(
        [
          part("a", [
            member(5, { reportedAt: at(7) }),
            member(6, { reportedAt: at(1) }),
            member(5, { reportedAt: at(3) }),
            member(5, { reportedAt: at(2) }),
          ]),
          part("b", [
            member(5, { reportedAt: at(1) }),
            member(5, { reportedAt: at(2) }),
            member(5, { reportedAt: at(9) }),
          ]),
        ],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.a.breakdown.speed5Points).toBe(5);
    expect(results.b.breakdown.speed5Points).toBe(4);
    expect(results.a.speed5AchievedAt).toBe(at(3).getTime());
    expect(results.b.speed5AchievedAt).toBe(at(9).getTime());
  });

  it("speed5: 到達者がminCount未満のパートはnull・0点になる", () => {
    const results = byId(
      computePartScores(
        [
          part("a", [
            member(5, { reportedAt: at(1) }),
            member(5, { reportedAt: at(2) }),
            member(4, { reportedAt: at(3) }),
          ]),
        ],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.a.speed5AchievedAt).toBeNull();
    expect(results.a.breakdown.speed5Points).toBe(0);
  });

  it("speed5: 報告日時がない団員は到達者に数えない", () => {
    const results = byId(
      computePartScores(
        [
          part("a", [
            member(5, { reportedAt: at(1) }),
            member(5, { reportedAt: at(2) }),
            member(10, { reportedAt: null }),
          ]),
        ],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.a.speed5AchievedAt).toBeNull();
  });

  it("speed5: 到達日時が同時刻のパートは同率タイになる", () => {
    const members = [
      member(5, { reportedAt: at(1) }),
      member(5, { reportedAt: at(2) }),
      member(5, { reportedAt: at(3) }),
    ];
    const results = byId(
      computePartScores([part("a", members), part("b", members)], DEFAULT_SCORING_CONFIG),
    );
    expect(results.a.breakdown.speed5Points).toBe(5);
    expect(results.b.breakdown.speed5Points).toBe(5);
  });

  it("speed10: 10枚到達者で判定し、5枚到達のみでは達成にならない", () => {
    const results = byId(
      computePartScores(
        [
          part("a", [
            member(10, { reportedAt: at(1) }),
            member(12, { reportedAt: at(2) }),
            member(10, { reportedAt: at(3) }),
          ]),
          part("b", [
            member(10, { reportedAt: at(4) }),
            member(10, { reportedAt: at(5) }),
            member(10, { reportedAt: at(6) }),
          ]),
          part("c", [
            member(9, { reportedAt: at(1) }),
            member(9, { reportedAt: at(2) }),
            member(9, { reportedAt: at(3) }),
          ]),
        ],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.a.speed10AchievedAt).toBe(at(3).getTime());
    expect(results.a.breakdown.speed10Points).toBe(5);
    expect(results.b.breakdown.speed10Points).toBe(4);
    expect(results.c.speed10AchievedAt).toBeNull();
    expect(results.c.breakdown.speed10Points).toBe(0);
    expect(results.c.breakdown.speed5Points).toBe(5);
  });

  it("speed: threshold/minCount/配点のカスタム設定が反映される", () => {
    const config: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      speed5: { enabled: true, points: [7], threshold: 2, minCount: 1 },
    };
    const results = byId(
      computePartScores([part("a", [member(2, { reportedAt: at(4) })])], config),
    );
    expect(results.a.speed5AchievedAt).toBe(at(4).getTime());
    expect(results.a.breakdown.speed5Points).toBe(7);
  });

  it("zeroRatio: ゼロ販売者の人数ではなく割合が少ない順に配点する", () => {
    const results = byId(
      computePartScores(
        [
          part("a", [member(1), member(1)]),
          part("b", [member(0), member(0), ...Array.from({ length: 8 }, () => member(1))]),
          part("c", [member(0), member(1)]),
        ],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.a.breakdown.zeroRatioPoints).toBe(4);
    expect(results.b.breakdown.zeroRatioPoints).toBe(3);
    expect(results.c.breakdown.zeroRatioPoints).toBe(2);
  });

  it("団員0名のパートは平均販売0枚・ゼロ販売割合1として扱う", () => {
    const results = byId(
      computePartScores([part("a", []), part("b", [member(0), member(1)])], DEFAULT_SCORING_CONFIG),
    );
    expect(results.b.breakdown.zeroRatioPoints).toBe(4);
    expect(results.a.breakdown.zeroRatioPoints).toBe(3);
    expect(results.a.breakdown.avgSalesPoints).toBe(8);
  });

  it("outreach: 団員の情宣回数の合計が多い順に配点する", () => {
    const results = byId(
      computePartScores(
        [
          part("a", [member(0, { outreachCount: 3 })]),
          part("b", [member(0, { outreachCount: 2 }), member(0, { outreachCount: 2 })]),
        ],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    expect(results.b.breakdown.outreachPoints).toBe(5);
    expect(results.a.breakdown.outreachPoints).toBe(4);
  });

  it("全員0枚販売: 販売系は同率タイ、速さは全パート0点になる", () => {
    const results = byId(
      computePartScores(
        [part("a", [member(0), member(0)]), part("b", [member(0)])],
        DEFAULT_SCORING_CONFIG,
      ),
    );
    for (const r of [results.a, results.b]) {
      expect(r.breakdown).toEqual({
        avgSalesPoints: 9,
        speed5Points: 0,
        speed10Points: 0,
        zeroRatioPoints: 4,
        outreachPoints: 5,
      });
      expect(r.speed5AchievedAt).toBeNull();
      expect(r.speed10AchievedAt).toBeNull();
    }
  });

  it("満点: 全基準で1位のパートは各基準の最高点の合計になる", () => {
    const top = part(
      "a",
      [at(1), at(2), at(3)].map((d) => member(10, { outreachCount: 3, reportedAt: d })),
    );
    const results = byId(
      computePartScores([top, part("b", [member(0), member(1)])], DEFAULT_SCORING_CONFIG),
    );
    expect(results.a.breakdown).toEqual({
      avgSalesPoints: 10,
      speed5Points: 5,
      speed10Points: 5,
      zeroRatioPoints: 4,
      outreachPoints: 5,
    });
    expect(results.a.totalPoints).toBe(29);
  });

  it("無効化した基準は0点になり合計に含まれない（達成日時は返す）", () => {
    const config: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      avgSales: { ...DEFAULT_SCORING_CONFIG.avgSales, enabled: false },
      speed5: { ...DEFAULT_SCORING_CONFIG.speed5, enabled: false },
    };
    const results = byId(
      computePartScores(
        [
          part(
            "a",
            [at(1), at(2), at(3)].map((d) => member(5, { reportedAt: d })),
          ),
        ],
        config,
      ),
    );
    expect(results.a.breakdown.avgSalesPoints).toBe(0);
    expect(results.a.breakdown.speed5Points).toBe(0);
    expect(results.a.speed5AchievedAt).toBe(at(3).getTime());
    expect(results.a.totalPoints).toBe(4 + 5);
  });
});

describe("resolveScoringConfig", () => {
  it("null/undefinedはデフォルト設定を返す", () => {
    expect(resolveScoringConfig(null)).toBe(DEFAULT_SCORING_CONFIG);
    expect(resolveScoringConfig(undefined)).toBe(DEFAULT_SCORING_CONFIG);
  });

  it("正しい形式の設定はそのまま返す", () => {
    const config: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      outreach: { enabled: false, points: [1] },
    };
    expect(resolveScoringConfig(config)).toEqual(config);
  });

  it("破損した設定はデフォルト設定にフォールバックする", () => {
    expect(resolveScoringConfig({ unexpected: "shape" })).toBe(DEFAULT_SCORING_CONFIG);
    expect(
      resolveScoringConfig({
        ...DEFAULT_SCORING_CONFIG,
        avgSales: { enabled: true, points: [] },
      }),
    ).toBe(DEFAULT_SCORING_CONFIG);
  });
});

describe("withLabels", () => {
  it("各基準に表示ラベルを付与する", () => {
    const labeled = withLabels(DEFAULT_SCORING_CONFIG);
    expect(labeled.avgSales).toEqual({
      label: "平均販売枚数",
      enabled: true,
      points: [10, 8, 6, 4],
    });
    expect(labeled.speed5.label).toBe("速さ（5枚×3名）");
    expect(labeled.speed10.label).toBe("速さ（10枚×3名）");
    expect(labeled.zeroRatio.label).toBe("ゼロ販売割合（少順）");
    expect(labeled.outreach.label).toBe("情宣回数");
  });
});
