import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConcertSection } from "../ConcertSection";
import { type ConcertWithScores } from "@/lib/scores-api";

const baseConcert: ConcertWithScores = {
  id: "concert-1",
  title: "第20回定期演奏会",
  heldOn: "2026-11-23",
  venue: "○○ホール",
  stages: [
    {
      id: "stage-1",
      name: "第1ステージ",
      sortOrder: 0,
      programs: [
        {
          id: "program-1",
          title: "",
          sortOrder: 0,
          score: { id: "score-1", title: "男声合唱のための〇〇", composer: "△△", arranger: null },
        },
      ],
    },
    {
      id: "stage-2",
      name: "第2ステージ",
      sortOrder: 1,
      programs: [
        {
          id: "program-2",
          title: "",
          sortOrder: 0,
          score: { id: "score-2", title: "××組曲", composer: "○○", arranger: null },
        },
      ],
    },
  ],
};

describe("ConcertSection（表示）", () => {
  it("演奏会名・日付・会場・合計曲数を表示する", () => {
    render(<ConcertSection concert={baseConcert} orgSlug="tokyo-men-choir" />);

    expect(screen.getByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("2026年11月23日 ・ ○○ホール ・ 2曲")).toBeInTheDocument();
  });

  it("複数ステージの場合はステージ名を表示する", () => {
    render(<ConcertSection concert={baseConcert} orgSlug="tokyo-men-choir" />);

    expect(screen.getByText("第1ステージ")).toBeInTheDocument();
    expect(screen.getByText("第2ステージ")).toBeInTheDocument();
  });

  it("単一ステージの場合はステージ名を表示しない", () => {
    const single: ConcertWithScores = { ...baseConcert, stages: [baseConcert.stages[0]] };
    render(<ConcertSection concert={single} orgSlug="tokyo-men-choir" />);

    expect(screen.queryByText("第1ステージ")).not.toBeInTheDocument();
  });

  it("曲目が0件の場合は「曲目が登録されていません」を表示する", () => {
    const empty: ConcertWithScores = { ...baseConcert, stages: [] };
    render(<ConcertSection concert={empty} orgSlug="tokyo-men-choir" />);

    expect(screen.getByText("曲目が登録されていません")).toBeInTheDocument();
  });

  it("各曲目行をリンクとして表示する", () => {
    render(<ConcertSection concert={baseConcert} orgSlug="tokyo-men-choir" />);

    const link = screen.getByText("男声合唱のための〇〇").closest("a");
    expect(link).toHaveAttribute("href", "/tokyo-men-choir/scores/score-1");
  });
});

describe("ConcertSection（開閉）", () => {
  it("初期状態は開いており、クリックで閉じる", async () => {
    const user = userEvent.setup();
    render(<ConcertSection concert={baseConcert} orgSlug="tokyo-men-choir" />);

    expect(screen.getByText("男声合唱のための〇〇")).toBeInTheDocument();

    await user.click(screen.getByText("第20回定期演奏会"));
    expect(screen.queryByText("男声合唱のための〇〇")).not.toBeInTheDocument();

    await user.click(screen.getByText("第20回定期演奏会"));
    expect(screen.getByText("男声合唱のための〇〇")).toBeInTheDocument();
  });
});
