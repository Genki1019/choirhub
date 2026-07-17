import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoringRules } from "../ScoringRules";
import type { RaceScoringConfig } from "@/lib/tickets-api";

function makeScoring(): RaceScoringConfig {
  return {
    avgSales: { label: "平均販売", points: [10, 6, 3] },
    speed5: { label: "速5枚", threshold: 5, minCount: 3, points: [10, 6, 3] },
    speed10: { label: "速10枚", threshold: 10, minCount: 3, points: [10, 6, 3] },
    zeroRatio: { label: "ゼロ率", points: [10, 6, 3] },
    outreach: { label: "情宣", points: [10, 6, 3] },
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
});
