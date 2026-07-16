import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnassignedSection } from "../UnassignedSection";
import { type ScoreSummary } from "@/lib/scores-api";

const scores: ScoreSummary[] = [
  { id: "score-1", title: "□□の詩", composer: "◇◇", arranger: null },
  { id: "score-2", title: "△△幻想曲", composer: null, arranger: "☆☆" },
];

describe("UnassignedSection（表示）", () => {
  it("0件の場合は何も表示しない", () => {
    const { container } = render(<UnassignedSection scores={[]} orgSlug="tokyo-men-choir" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("件数と各曲目を一覧表示する", () => {
    render(<UnassignedSection scores={scores} orgSlug="tokyo-men-choir" />);

    expect(screen.getByText("演奏会未定")).toBeInTheDocument();
    expect(screen.getByText("2曲")).toBeInTheDocument();
    expect(screen.getByText("□□の詩")).toBeInTheDocument();
    expect(screen.getByText("△△幻想曲")).toBeInTheDocument();
  });

  it("各曲目行をリンクとして表示する", () => {
    render(<UnassignedSection scores={scores} orgSlug="tokyo-men-choir" />);

    const link = screen.getByText("□□の詩").closest("a");
    expect(link).toHaveAttribute("href", "/tokyo-men-choir/scores/score-1");
  });
});

describe("UnassignedSection（開閉）", () => {
  it("初期状態は開いており、クリックで閉じる", async () => {
    const user = userEvent.setup();
    render(<UnassignedSection scores={scores} orgSlug="tokyo-men-choir" />);

    expect(screen.getByText("□□の詩")).toBeInTheDocument();

    await user.click(screen.getByText("演奏会未定"));
    expect(screen.queryByText("□□の詩")).not.toBeInTheDocument();
  });
});
