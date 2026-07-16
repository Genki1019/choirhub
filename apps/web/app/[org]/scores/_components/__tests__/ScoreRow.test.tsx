import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreRow } from "../ScoreRow";
import { type ScoreSummary } from "@/lib/scores-api";

function makeScore(overrides: Partial<ScoreSummary> = {}): ScoreSummary {
  return {
    id: "score-1",
    title: "男声合唱のための〇〇",
    composer: null,
    arranger: null,
    ...overrides,
  };
}

describe("ScoreRow", () => {
  it("曲名と楽譜詳細へのリンクを表示する", () => {
    render(<ScoreRow score={makeScore()} orgSlug="tokyo-men-choir" />);

    expect(screen.getByText("男声合唱のための〇〇")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/tokyo-men-choir/scores/score-1");
  });

  it("作曲者・編曲者の両方がある場合は両方表示する", () => {
    render(<ScoreRow score={makeScore({ composer: "△△", arranger: "□□" })} orgSlug="o" />);

    expect(screen.getByText("△△ 作曲 / □□ 編曲")).toBeInTheDocument();
  });

  it("作曲者のみの場合は作曲者だけ表示する", () => {
    render(<ScoreRow score={makeScore({ composer: "△△" })} orgSlug="o" />);

    expect(screen.getByText("△△ 作曲")).toBeInTheDocument();
  });

  it("作曲者・編曲者がともに無い場合は行を表示しない", () => {
    render(<ScoreRow score={makeScore()} orgSlug="o" />);

    expect(screen.queryByText(/作曲|編曲/)).not.toBeInTheDocument();
  });
});
