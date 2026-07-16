import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HomePage from "../page";
import { homeApi, type HomeData } from "@/lib/home-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/home-api", () => ({
  homeApi: {
    get: vi.fn(),
    setMonthlyOrganizer: vi.fn(),
  },
}));

const baseEvent = {
  id: "event-1",
  title: "第12回定期練習",
  category: { id: "cat-1", name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 0 },
  startsAt: "2026-08-10T09:30:00Z",
  location: "○○公民館",
  concertId: null,
  myAttendance: "attending" as const,
};

const baseHomeData: HomeData = {
  upcomingEvents: [],
  nextRehearsal: null,
  nextConcert: null,
  unansweredEventCount: 0,
  recentMails: [],
  canViewTickets: false,
  monthlyOrganizer: null,
  isTicketManager: false,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("HomePage（ローディング）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(homeApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });
});

describe("HomePage（次回練習・次回本番）", () => {
  it("nextRehearsal・nextConcertが無い場合は「予定なし」を表示する", async () => {
    vi.mocked(homeApi.get).mockResolvedValue(baseHomeData);
    renderPage();

    expect(await screen.findAllByText("予定なし")).toHaveLength(2);
  });

  it("nextRehearsalがある場合は日数を表示する", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      nextRehearsal: baseEvent,
    });
    renderPage();

    expect(await screen.findByText("次回練習まで")).toBeInTheDocument();
    expect(screen.getByText("第12回定期練習")).toBeInTheDocument();
  });

  it("nextConcertがある場合は日数を表示する", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      nextConcert: { ...baseEvent, id: "event-2", title: "第20回定期演奏会" },
    });
    renderPage();

    expect(await screen.findByText("次回本番まで")).toBeInTheDocument();
    expect(screen.getByText("第20回定期演奏会")).toBeInTheDocument();
  });
});

describe("HomePage（出欠未回答バッジ）", () => {
  it("unansweredEventCountが0の場合はバッジを表示しない", async () => {
    vi.mocked(homeApi.get).mockResolvedValue(baseHomeData);
    renderPage();

    await screen.findAllByText("予定なし");
    expect(screen.queryByText(/出欠未回答/)).not.toBeInTheDocument();
  });

  it("unansweredEventCountが1以上の場合はバッジを表示する", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({ ...baseHomeData, unansweredEventCount: 3 });
    renderPage();

    expect(await screen.findByText("出欠未回答 3件")).toBeInTheDocument();
  });

  it("未回答が1件かつupcomingEvents内に見つかる場合: そのイベント詳細へのリンクになる", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      unansweredEventCount: 1,
      upcomingEvents: [
        { ...baseEvent, id: "event-1", myAttendance: "attending" },
        { ...baseEvent, id: "event-2", myAttendance: "undecided" },
      ],
    });
    renderPage();

    const badge = await screen.findByText("出欠未回答 1件");
    expect(badge.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/schedule/event-2");
  });

  it("未回答が2件以上の場合: スケジュール一覧へのリンクになる", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      unansweredEventCount: 2,
      upcomingEvents: [{ ...baseEvent, id: "event-1", myAttendance: "undecided" }],
    });
    renderPage();

    const badge = await screen.findByText("出欠未回答 2件");
    expect(badge.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/schedule");
  });

  it("未回答が1件だがupcomingEvents内に見つからない場合: スケジュール一覧へフォールバックする", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      unansweredEventCount: 1,
      upcomingEvents: [{ ...baseEvent, id: "event-1", myAttendance: "attending" }],
    });
    renderPage();

    const badge = await screen.findByText("出欠未回答 1件");
    expect(badge.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/schedule");
  });
});

describe("HomePage（直近の予定）", () => {
  it("upcomingEventsが空の場合は「直近の予定はありません」を表示する", async () => {
    vi.mocked(homeApi.get).mockResolvedValue(baseHomeData);
    renderPage();

    expect(await screen.findByText("直近の予定はありません")).toBeInTheDocument();
  });

  it("upcomingEventsがある場合はEventCardを並べる", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      upcomingEvents: [baseEvent, { ...baseEvent, id: "event-2", title: "第13回定期練習" }],
    });
    renderPage();

    expect(await screen.findByText("第12回定期練習")).toBeInTheDocument();
    expect(screen.getByText("第13回定期練習")).toBeInTheDocument();
  });
});

describe("HomePage（最近のメール）", () => {
  it("recentMailsが空の場合はセクション自体を表示しない", async () => {
    vi.mocked(homeApi.get).mockResolvedValue(baseHomeData);
    renderPage();

    await screen.findAllByText("予定なし");
    expect(screen.queryByText("最近のメール")).not.toBeInTheDocument();
  });

  it("recentMailsがある場合は送信者名と件名を表示する", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      recentMails: [
        {
          id: "mail-1",
          subject: "6月練習のご案内",
          sentAt: "2026-05-30T12:00:00Z",
          senderName: "山田太郎",
          senderAvatarUrl: null,
        },
      ],
    });
    renderPage();

    expect(await screen.findByText("最近のメール")).toBeInTheDocument();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("6月練習のご案内")).toBeInTheDocument();
  });
});

describe("HomePage（今月の幹事の更新反映）", () => {
  it("編集して保存すると、再取得なしで画面表示がキャッシュ経由で更新される", async () => {
    vi.mocked(homeApi.get).mockResolvedValue({
      ...baseHomeData,
      isTicketManager: true,
      monthlyOrganizer: null,
    });
    vi.mocked(homeApi.setMonthlyOrganizer).mockResolvedValue({ monthlyOrganizer: "Bass II" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("未設定");
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "Bass II");
    await user.click(screen.getByLabelText("保存"));

    await waitFor(() => {
      expect(screen.getByText("Bass II")).toBeInTheDocument();
    });
    expect(homeApi.get).toHaveBeenCalledTimes(1);
  });
});
