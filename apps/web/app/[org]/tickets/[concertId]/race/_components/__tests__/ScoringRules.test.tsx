import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoringRules } from "../ScoringRules";
import type { RaceScoringConfig } from "@/lib/tickets-api";

function makeScoring(overrides: Partial<RaceScoringConfig> = {}): RaceScoringConfig {
  return {
    avgSales: { label: "平均販売", enabled: true, points: [10, 6, 3] },
    speed5: { label: "速5枚", enabled: true, threshold: 5, minCount: 3, points: [10, 6, 3] },
    speed10: { label: "速10枚", enabled: true, threshold: 10, minCount: 3, points: [10, 6, 3] },
    zeroRatio: { label: "ゼロ率", enabled: true, points: [10, 6, 3] },
    outreach: { label: "情宣", enabled: true, points: [10, 6, 3] },
    ...overrides,
  };
}

describe("ScoringRules", () => {
  it("各ルールのラベルとポイントを表示する", () => {
    render(<ScoringRules scoring={makeScoring()} />);

    expect(screen.getByText("ポイントルール")).toBeInTheDocument();
    expect(screen.getAllByText("10, 6, 3pt").length).toBe(5);
    expect(screen.getByText("平均販売")).toBeInTheDocument();
    expect(screen.getByText("速5枚")).toBeInTheDocument();
    expect(screen.getByText("速10枚")).toBeInTheDocument();
    expect(screen.getByText("ゼロ率")).toBeInTheDocument();
    expect(screen.getByText("情宣")).toBeInTheDocument();
  });

  it("無効化された基準は表示から除外される", () => {
    render(
      <ScoringRules
        scoring={makeScoring({ outreach: { label: "情宣", enabled: false, points: [10, 6, 3] } })}
      />,
    );

    expect(screen.queryByText("情宣")).not.toBeInTheDocument();
    expect(screen.getAllByText("10, 6, 3pt").length).toBe(4);
  });
});
