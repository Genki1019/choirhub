import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar } from "../Calendar";
import type { EventSummary } from "@/lib/events-api";

function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: "event-1",
    title: "第12回定期練習",
    category: { id: "cat-1", name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 0 },
    startsAt: "2026-07-10T09:30:00Z",
    endsAt: "2026-07-10T12:00:00Z",
    location: null,
    locationUrl: null,
    deadline: null,
    rehearsalContent: null,
    timeSchedule: null,
    practiceVenue: null,
    otherNotes: null,
    isLocked: false,
    targetRoles: null,
    targetPartIds: null,
    concertId: null,
    myAttendance: "attending",
    ...overrides,
  };
}

const today = new Date("2026-07-16T00:00:00");

describe("Calendar（表示）", () => {
  it("年月見出しを表示する", () => {
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    expect(screen.getByText("2026年 7月")).toBeInTheDocument();
  });

  it("日曜列は赤、土曜列はブランドカラーで表示する", () => {
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    expect(screen.getByText("日")).toHaveClass("text-red-500");
    expect(screen.getByText("土")).toHaveClass("text-brand-500");
  });

  it("2026年7月（1日は水曜）の日付セルが正しい曜日列に配置される", () => {
    const { container } = render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    // 日付セルは曜日ヘッダーの後、7列グリッドで並ぶ。1日は水曜（インデックス3）に来るはず
    const dayCells = container.querySelectorAll(".grid.grid-cols-7:last-child > div");
    expect(dayCells[0].textContent).toBe("");
    expect(dayCells[1].textContent).toBe("");
    expect(dayCells[2].textContent).toBe("");
    expect(dayCells[3].textContent).toContain("1");
  });

  it("今日のセルがハイライトされる", () => {
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    // today = 2026-07-16
    const todayLabel = screen.getByText("16");
    expect(todayLabel).toHaveClass("bg-brand-600");
  });

  it("その日のイベントのタイトルとカテゴリ色を表示する", () => {
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[makeEvent({ startsAt: "2026-07-10T09:30:00+09:00" })]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    const title = screen.getByText("第12回定期練習");
    expect(title).toBeInTheDocument();
    const link = title.closest("a");
    expect(link).toHaveStyle({ color: "#3B82F6" });
  });

  it("出欠記号は sm 以上でのみ表示するクラスが付与されている", () => {
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[makeEvent({ startsAt: "2026-07-10T09:30:00+09:00", myAttendance: "attending" })]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    const symbol = screen.getByText("○");
    expect(symbol).toHaveClass("hidden", "sm:inline");
  });
});

describe("Calendar（リンク先）", () => {
  it("concertIdが無い場合: /schedule/[id]へのリンクになる", () => {
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[
          makeEvent({ id: "event-1", startsAt: "2026-07-10T09:30:00+09:00", concertId: null }),
        ]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    expect(screen.getByText("第12回定期練習").closest("a")).toHaveAttribute(
      "href",
      "/tokyo/schedule/event-1",
    );
  });

  it("concertIdがある場合: 演奏会ページ(from=schedule)へのリンクになる", () => {
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[
          makeEvent({
            id: "event-1",
            startsAt: "2026-07-10T09:30:00+09:00",
            concertId: "concert-1",
          }),
        ]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    expect(screen.getByText("第12回定期練習").closest("a")).toHaveAttribute(
      "href",
      "/tokyo/concerts/concert-1?tab=survey&from=schedule",
    );
  });
});

describe("Calendar（月ナビゲーション）", () => {
  it("「前の月」クリックでonPrevMonthが呼ばれる", async () => {
    const onPrevMonth = vi.fn();
    const user = userEvent.setup();
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[]}
        org="tokyo"
        onPrevMonth={onPrevMonth}
        onNextMonth={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("前の月"));
    expect(onPrevMonth).toHaveBeenCalled();
  });

  it("「次の月」クリックでonNextMonthが呼ばれる", async () => {
    const onNextMonth = vi.fn();
    const user = userEvent.setup();
    render(
      <Calendar
        year={2026}
        month={7}
        today={today}
        events={[]}
        org="tokyo"
        onPrevMonth={vi.fn()}
        onNextMonth={onNextMonth}
      />,
    );
    await user.click(screen.getByLabelText("次の月"));
    expect(onNextMonth).toHaveBeenCalled();
  });
});
