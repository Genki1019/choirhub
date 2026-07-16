import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScheduleDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { eventsApi } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import type { EventDetail } from "@/lib/events-api";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", id: "event-1" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/events-api", () => ({
  eventsApi: {
    get: vi.fn(),
    delete: vi.fn(),
    updateAttendance: vi.fn(),
  },
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    list: vi.fn(),
    parts: vi.fn(),
  },
}));

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: "event-1",
    title: "第12回定期練習",
    category: { id: "cat-1", name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 0 },
    startsAt: "2026-07-20T18:30:00+09:00",
    endsAt: "2026-07-20T21:00:00+09:00",
    location: "○○公民館",
    locationUrl: null,
    deadline: null,
    pageMemo: null,
    isLocked: false,
    targetRoles: null,
    targetPartIds: null,
    concertId: null,
    invitedCount: 1,
    attendances: [],
    summary: { attending: 0, absent: 0, maybe: 0, undecided: 1 },
    ...overrides,
  };
}

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <ScheduleDetailPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.list).mockResolvedValue([]);
  vi.mocked(membersApi.parts).mockResolvedValue([]);
});

describe("ScheduleDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(eventsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はヘッダーとエラーメッセージを表示する", async () => {
    vi.mocked(eventsApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("イベント詳細")).toBeInTheDocument();
    expect(screen.getByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("タイトル・日時・場所を表示する", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
    renderPage();

    expect(await screen.findByText("第12回定期練習")).toBeInTheDocument();
    expect(screen.getByText(/7\/20（月）18:30〜21:00/)).toBeInTheDocument();
    expect(screen.getByText("○○公民館")).toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（バッジ表示）", () => {
  it("isLocked=trueの場合: 「締切済み」バッジを表示し「回答済み」は出さない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        isLocked: true,
        attendances: [
          {
            member: { id: "member-self", nameJa: "自分", part: null },
            status: "attending",
            arriveTime: null,
            leaveTime: null,
            dayMemo: null,
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("締切済み")).toBeInTheDocument();
    expect(screen.queryByText("回答済み")).not.toBeInTheDocument();
  });

  it("isLocked=falseかつ自分が回答済みの場合: 「回答済み」バッジを表示する", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        isLocked: false,
        attendances: [
          {
            member: { id: "member-self", nameJa: "自分", part: null },
            status: "attending",
            arriveTime: null,
            leaveTime: null,
            dayMemo: null,
          },
        ],
      }),
    );
    vi.mocked(membersApi.list).mockResolvedValue([
      { id: "member-self", nameJa: "自分", part: null } as never,
    ]);
    renderPage();

    expect(await screen.findByText("回答済み")).toBeInTheDocument();
    expect(screen.queryByText("締切済み")).not.toBeInTheDocument();
  });

  it("自分が未回答の場合: 「回答済み」バッジを表示しない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ isLocked: false, attendances: [] }));
    vi.mocked(membersApi.list).mockResolvedValue([
      { id: "member-self", nameJa: "自分", part: null } as never,
    ]);
    renderPage();

    await screen.findByText("第12回定期練習");
    expect(screen.queryByText("回答済み")).not.toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（編集・削除ボタンの権限）", () => {
  it.each([["admin"], ["tech"], ["conductor"]])(
    "%sロール: 「編集」「削除」ボタンを表示する",
    async (role) => {
      vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
      renderPage([role]);

      expect(await screen.findByText("編集")).toBeInTheDocument();
      expect(screen.getByText("削除")).toBeInTheDocument();
    },
  );

  it("member: 「編集」「削除」ボタンを表示しない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent());
    renderPage(["member"]);

    await screen.findByText("第12回定期練習");
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
    expect(screen.queryByText("削除")).not.toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（全体備考）", () => {
  it("pageMemoが無い場合: 全体備考セクションを表示しない", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ pageMemo: null }));
    renderPage();

    await screen.findByText("第12回定期練習");
    expect(screen.queryByText("全体備考")).not.toBeInTheDocument();
  });

  it("pageMemoがある場合: 全体備考セクションを表示する", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(makeEvent({ pageMemo: "楽譜をご持参ください" }));
    renderPage();

    expect(await screen.findByText("全体備考")).toBeInTheDocument();
    expect(screen.getByText("楽譜をご持参ください")).toBeInTheDocument();
  });
});

describe("ScheduleDetailPage（場所リンク）", () => {
  it("locationUrlが無い場合: Googleマップ検索URLにフォールバックする", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({ location: "○○公民館", locationUrl: null }),
    );
    renderPage();

    const link = await screen.findByText("○○公民館");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=%E2%97%8B%E2%97%8B%E5%85%AC%E6%B0%91%E9%A4%A8",
    );
  });

  it("locationUrlがある場合: そのURLを使う", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(
      makeEvent({
        location: "○○公民館",
        locationUrl: "https://maps.example.com/xyz",
      }),
    );
    renderPage();

    const link = await screen.findByText("○○公民館");
    expect(link.closest("a")).toHaveAttribute("href", "https://maps.example.com/xyz");
  });
});
