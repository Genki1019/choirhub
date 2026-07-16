import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventCard } from "../EventCard";
import type { EventCardItem, AttendanceStatus } from "@/lib/events-api";

const baseEvent: EventCardItem = {
  id: "event-1",
  title: "第12回定期練習",
  category: { id: "cat-1", name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 0 },
  startsAt: "2026-08-10T09:30:00Z",
  location: "○○公民館",
  concertId: null,
  myAttendance: "attending",
};

describe("EventCard（表示）", () => {
  it("日付・タイトル・場所を表示する", () => {
    render(<EventCard event={baseEvent} org="tokyo-men-choir" />);

    expect(screen.getByText("第12回定期練習")).toBeInTheDocument();
    expect(screen.getByText("○○公民館")).toBeInTheDocument();
    expect(screen.getByText(/8\/10（月）18:30〜/)).toBeInTheDocument();
  });

  it("locationがnullの場合: 場所を表示しない", () => {
    render(<EventCard event={{ ...baseEvent, location: null }} org="tokyo-men-choir" />);

    expect(screen.queryByText("○○公民館")).not.toBeInTheDocument();
  });

  it("カテゴリの色を左端のバーに反映する", () => {
    const { container } = render(<EventCard event={baseEvent} org="tokyo-men-choir" />);
    const colorBar = container.querySelector(".w-1");
    expect(colorBar).toHaveStyle({ backgroundColor: "#3B82F6" });
  });
});

describe("EventCard（出欠ステータス表示）", () => {
  it.each([
    ["attending", "参加", "text-teal-600"],
    ["absent", "欠席", "text-red-500"],
    ["maybe", "未定", "text-yellow-600"],
    ["undecided", "未回答", "text-gray-400"],
  ] as [AttendanceStatus, string, string][])(
    "myAttendanceが%sの場合: 「%s」を%sで表示する",
    (myAttendance, label, className) => {
      render(<EventCard event={{ ...baseEvent, myAttendance }} org="tokyo-men-choir" />);
      expect(screen.getByText(label)).toHaveClass(className);
    },
  );
});

describe("EventCard（リンク先）", () => {
  it("concertIdが無い場合: スケジュール詳細へのリンクになる", () => {
    render(<EventCard event={baseEvent} org="tokyo-men-choir" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tokyo-men-choir/schedule/event-1");
  });

  it("concertIdがある場合: fromを省略するとhome扱いで演奏会ページへのリンクになる", () => {
    render(<EventCard event={{ ...baseEvent, concertId: "concert-1" }} org="tokyo-men-choir" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/tokyo-men-choir/concerts/concert-1?tab=stages&from=home",
    );
  });

  it("concertIdがある場合: from='schedule'を指定するとtab/fromが切り替わる", () => {
    render(
      <EventCard
        event={{ ...baseEvent, concertId: "concert-1" }}
        org="tokyo-men-choir"
        from="schedule"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/tokyo-men-choir/concerts/concert-1?tab=survey&from=schedule",
    );
  });
});
