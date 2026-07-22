import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventList } from "../EventList";
import type { EventSummary } from "@/lib/events-api";

function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: "event-1",
    title: "第12回定期練習",
    category: { id: "cat-1", name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 0 },
    startsAt: "2026-07-20T09:30:00+09:00",
    endsAt: "2026-07-20T12:00:00+09:00",
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
    myAttendance: "undecided",
    ...overrides,
  };
}

beforeEach(() => {
  // 「今日」= 2026-07-16
  vi.setSystemTime(new Date("2026-07-16T00:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EventList（表示・ソート・フィルタ）", () => {
  it("見出しに「{month}月の予定」を表示する", () => {
    render(<EventList events={[]} year={2026} month={7} org="tokyo" />);
    expect(screen.getByText("7月の予定")).toBeInTheDocument();
  });

  it("対象月かつ今日以降のイベントのみ表示する", () => {
    render(
      <EventList
        events={[
          makeEvent({ id: "past", title: "過去のイベント", startsAt: "2026-07-01T09:00:00+09:00" }),
          makeEvent({
            id: "other-month",
            title: "来月のイベント",
            startsAt: "2026-08-01T09:00:00+09:00",
          }),
          makeEvent({
            id: "this-month",
            title: "今月未来のイベント",
            startsAt: "2026-07-20T09:00:00+09:00",
          }),
        ]}
        year={2026}
        month={7}
        org="tokyo"
      />,
    );
    expect(screen.getByText("今月未来のイベント")).toBeInTheDocument();
    expect(screen.queryByText("過去のイベント")).not.toBeInTheDocument();
    expect(screen.queryByText("来月のイベント")).not.toBeInTheDocument();
  });

  it("開始日時の昇順でソートされる", () => {
    render(
      <EventList
        events={[
          makeEvent({ id: "later", title: "後のイベント", startsAt: "2026-07-25T09:00:00+09:00" }),
          makeEvent({ id: "sooner", title: "先のイベント", startsAt: "2026-07-18T09:00:00+09:00" }),
        ]}
        year={2026}
        month={7}
        org="tokyo"
      />,
    );
    const links = screen.getAllByRole("link").map((el) => el.textContent);
    expect(links.findIndex((t) => t?.includes("先のイベント"))).toBeLessThan(
      links.findIndex((t) => t?.includes("後のイベント")),
    );
  });
});

describe("EventList（空状態メッセージ）", () => {
  it("表示月が未来月で0件の場合: 「予定はありません」", () => {
    render(<EventList events={[]} year={2026} month={8} org="tokyo" />);
    expect(screen.getByText("予定はありません")).toBeInTheDocument();
  });

  it("表示月が今月で0件の場合: 「予定はすべて終了しました」", () => {
    render(<EventList events={[]} year={2026} month={7} org="tokyo" />);
    expect(screen.getByText("予定はすべて終了しました")).toBeInTheDocument();
  });

  it("表示月が過去月で0件の場合: 「予定はすべて終了しました」", () => {
    render(<EventList events={[]} year={2026} month={6} org="tokyo" />);
    expect(screen.getByText("予定はすべて終了しました")).toBeInTheDocument();
  });
});
