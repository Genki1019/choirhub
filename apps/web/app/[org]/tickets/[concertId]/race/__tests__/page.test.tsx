import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RacePage from "../page";
import { ticketsApi, type RaceData } from "@/lib/tickets-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", concertId: "concert-1" }),
}));

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      race: vi.fn(),
      publishRace: vi.fn(),
      unpublishRace: vi.fn(),
    },
  };
});

function makeScoring() {
  return {
    avgSales: { label: "平均販売", points: [10, 6, 3] },
    speed5: { label: "速5枚", threshold: 5, minCount: 3, points: [10, 6, 3] },
    speed10: { label: "速10枚", threshold: 10, minCount: 3, points: [10, 6, 3] },
    zeroRatio: { label: "ゼロ率", points: [10, 6, 3] },
    outreach: { label: "情宣", points: [10, 6, 3] },
  };
}

function makeRaceData(overrides: Partial<RaceData> = {}): RaceData {
  return {
    concert: { id: "concert-1", title: "第20回定期演奏会" },
    isTicketManager: true,
    racePublishedAt: null,
    scoring: makeScoring(),
    parts: [
      {
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
          speed5AchievedAt: null,
          speed10AchievedAt: null,
          zeroSellerRatio: 0.1,
          totalOutreach: 8,
          memberCount: 5,
          allocated: 50,
          sold: 40,
        },
      },
    ],
    individuals: [
      {
        memberId: "member-1",
        nameJa: "山田太郎",
        partId: "part-1",
        partName: "テノール1",
        allocated: 10,
        sold: 8,
        outreachCount: 3,
        rate: 0.8,
        rank: 1,
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RacePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RacePage（表示）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.race).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.race).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("配布・販売データが0件の場合は案内メッセージを表示する", async () => {
    vi.mocked(ticketsApi.race).mockResolvedValue(makeRaceData({ individuals: [] }));
    renderPage();

    expect(await screen.findByText("まだ配布・販売データがありません")).toBeInTheDocument();
  });

  it("パート順位タブでPartCardを表示する", async () => {
    vi.mocked(ticketsApi.race).mockResolvedValue(makeRaceData());
    renderPage();

    expect(await screen.findByText("テノール1")).toBeInTheDocument();
    expect(screen.queryByText("山田太郎")).not.toBeInTheDocument();
  });

  it("個人順位タブに切り替えるとIndividualTableを表示する", async () => {
    vi.mocked(ticketsApi.race).mockResolvedValue(makeRaceData());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("テノール1");
    await user.click(screen.getByRole("button", { name: /個人順位/ }));

    expect(screen.getByText("山田太郎")).toBeInTheDocument();
  });

  it("isTicketManager: falseの場合は公開ボタンを表示しない", async () => {
    vi.mocked(ticketsApi.race).mockResolvedValue(makeRaceData({ isTicketManager: false }));
    renderPage();

    await screen.findByText("テノール1");
    expect(screen.queryByText("全体に公開")).not.toBeInTheDocument();
  });
});

describe("RacePage（公開操作）", () => {
  it("「全体に公開」クリックでpublishRaceが呼ばれ公開状態になる", async () => {
    vi.mocked(ticketsApi.race).mockResolvedValue(makeRaceData());
    vi.mocked(ticketsApi.publishRace).mockResolvedValue({
      racePublishedAt: "2026-06-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("全体に公開"));

    expect(ticketsApi.publishRace).toHaveBeenCalledWith("tokyo-men-choir", "concert-1");
    expect(await screen.findByText("公開取消")).toBeInTheDocument();
  });

  it("「公開取消」クリックでunpublishRaceが呼ばれ未公開状態になる", async () => {
    vi.mocked(ticketsApi.race).mockResolvedValue(
      makeRaceData({ racePublishedAt: "2026-06-01T00:00:00+09:00" }),
    );
    vi.mocked(ticketsApi.unpublishRace).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("公開取消"));

    expect(ticketsApi.unpublishRace).toHaveBeenCalledWith("tokyo-men-choir", "concert-1");
    expect(await screen.findByText("全体に公開")).toBeInTheDocument();
  });
});
