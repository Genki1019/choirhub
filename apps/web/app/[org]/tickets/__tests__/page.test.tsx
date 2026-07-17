import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TicketsPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { ticketsApi, type TicketConcertSummary, type MyAllocationConcert } from "@/lib/tickets-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      list: vi.fn(),
      myList: vi.fn(),
    },
  };
});

function makeManagerItem(overrides: Partial<TicketConcertSummary> = {}): TicketConcertSummary {
  return {
    concertId: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    status: "draft",
    batchCount: 1,
    totalAllocated: 40,
    totalSold: 28,
    soldRate: 0.7,
    collectedCount: 8,
    memberCount: 10,
    ...overrides,
  };
}

function makeMyItem(overrides: Partial<MyAllocationConcert> = {}): MyAllocationConcert {
  return {
    concertId: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    racePublishedAt: null,
    ticketInputClosedAt: null,
    batches: [
      {
        allocationId: "alloc-1",
        batchId: "batch-1",
        batchName: "一般",
        price: 2000,
        priceStudent: 1000,
        allocatedCount: 10,
        requestedCount: null,
        soldAdult: 6,
        soldStudent: 0,
        soldOther: 0,
        returnedCount: 0,
        outreachCount: 0,
        reportedAt: null,
      },
    ],
    ...overrides,
  };
}

function renderPage(roles: string[] = ["ticket"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <TicketsPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("TicketsPage（チケット担当者・admin）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する（403以外は自動リトライされるため待つ）", async () => {
    vi.mocked(ticketsApi.list).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(
      await screen.findByText("取得に失敗しました", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
  }, 12000);

  it("0件の場合は空表示を出す", async () => {
    vi.mocked(ticketsApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("演奏会が登録されていません")).toBeInTheDocument();
  });

  it("ManagerConcertCardを表示し詳細へリンクする", async () => {
    vi.mocked(ticketsApi.list).mockResolvedValue([makeManagerItem()]);
    renderPage();

    const link = await screen.findByText("第20回定期演奏会");
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("28 / 40枚 販売済み")).toBeInTheDocument();
    expect(screen.getByText("10名配布")).toBeInTheDocument();
    expect(screen.getByText("未集金 2名")).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/tickets/concert-1");
  });

  it("席種未登録の場合は案内テキストを表示する", async () => {
    vi.mocked(ticketsApi.list).mockResolvedValue([makeManagerItem({ batchCount: 0 })]);
    renderPage();

    expect(await screen.findByText("席種未登録")).toBeInTheDocument();
  });

  it("未集金が0名の場合は強調表示しない", async () => {
    vi.mocked(ticketsApi.list).mockResolvedValue([
      makeManagerItem({ memberCount: 10, collectedCount: 10 }),
    ]);
    renderPage();

    await screen.findByText("第20回定期演奏会");
    expect(screen.queryByText(/未集金/)).not.toBeInTheDocument();
  });
});

describe("TicketsPage（一般団員・403フォールバック）", () => {
  it("403エラー時は自分の配布データにフォールバックする", async () => {
    vi.mocked(ticketsApi.list).mockRejectedValue(new ApiClientError("FORBIDDEN", "forbidden", 403));
    vi.mocked(ticketsApi.myList).mockResolvedValue([makeMyItem()]);
    renderPage(["member"]);

    const link = await screen.findByText("第20回定期演奏会");
    expect(link.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/tickets/concert-1/my");
  });

  it("MyConcertCardは席種名・価格・集計を表示する", async () => {
    vi.mocked(ticketsApi.list).mockRejectedValue(new ApiClientError("FORBIDDEN", "forbidden", 403));
    vi.mocked(ticketsApi.myList).mockResolvedValue([makeMyItem()]);
    renderPage(["member"]);

    await screen.findByText("第20回定期演奏会");
    expect(screen.getByText("一般 ¥2,000")).toBeInTheDocument();
    expect(screen.getByText("配布 10枚")).toBeInTheDocument();
    expect(screen.getByText("販売済み 6枚")).toBeInTheDocument();
    expect(screen.getByText("手元残 4枚")).toBeInTheDocument();
  });

  it("配布データが0件の場合は空表示を出す", async () => {
    vi.mocked(ticketsApi.list).mockRejectedValue(new ApiClientError("FORBIDDEN", "forbidden", 403));
    vi.mocked(ticketsApi.myList).mockResolvedValue([]);
    renderPage(["member"]);

    expect(await screen.findByText("チケットが配布されていません")).toBeInTheDocument();
  });

  it("配布登録が0枚の場合は「配布登録なし」を表示する", async () => {
    vi.mocked(ticketsApi.list).mockRejectedValue(new ApiClientError("FORBIDDEN", "forbidden", 403));
    vi.mocked(ticketsApi.myList).mockResolvedValue([makeMyItem({ batches: [] })]);
    renderPage(["member"]);

    expect(await screen.findByText("配布登録なし")).toBeInTheDocument();
  });
});
