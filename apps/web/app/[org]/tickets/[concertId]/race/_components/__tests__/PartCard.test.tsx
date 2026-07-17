import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartCard } from "../PartCard";
import type { RacePart, RaceScoringConfig } from "@/lib/tickets-api";

function makeScoring(): RaceScoringConfig {
  return {
    avgSales: { label: "平均販売", points: [10, 6, 3] },
    speed5: { label: "速5枚", threshold: 5, minCount: 3, points: [10, 6, 3] },
    speed10: { label: "速10枚", threshold: 10, minCount: 3, points: [10, 6, 3] },
    zeroRatio: { label: "ゼロ率", points: [10, 6, 3] },
    outreach: { label: "情宣", points: [10, 6, 3] },
  };
}

function makePart(overrides: Partial<RacePart> = {}): RacePart {
  return {
    partId: "part-1",
    partName: "テノール1",
    rank: 1,
    totalPoints: 35,
    breakdown: {
      avgSalesPoints: 10,
      speed5Points: 6,
      speed10Points: 3,
      zeroRatioPoints: 10,
      outreachPoints: 6,
    },
    stats: {
      avgSold: 4.5,
      speed5AchievedAt: "2026-05-10T00:00:00+09:00",
      speed10AchievedAt: null,
      zeroSellerRatio: 0.1,
      totalOutreach: 8,
      memberCount: 5,
      allocated: 50,
      sold: 40,
    },
    ...overrides,
  };
}

describe("PartCard（表示）", () => {
  it("パート名・合計ポイント・内訳・統計を表示する", () => {
    render(<PartCard part={makePart()} scoring={makeScoring()} />);

    expect(screen.getByText("テノール1")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("平均4.5枚")).toBeInTheDocument();
    expect(screen.getByText("情宣8回")).toBeInTheDocument();
  });

  it("ポイントが0の内訳は打ち消し線で表示される", () => {
    render(
      <PartCard
        part={makePart({
          breakdown: {
            avgSalesPoints: 0,
            speed5Points: 6,
            speed10Points: 3,
            zeroRatioPoints: 10,
            outreachPoints: 6,
          },
        })}
        scoring={makeScoring()}
      />,
    );

    expect(screen.getByText("平均販売")).toHaveClass("line-through");
  });

  it("速達成日時がある場合は日付を表示する", () => {
    render(<PartCard part={makePart()} scoring={makeScoring()} />);

    expect(screen.getByText(/5枚×3名:/)).toBeInTheDocument();
    expect(screen.queryByText(/10枚×3名:/)).not.toBeInTheDocument();
  });
});
