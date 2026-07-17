import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MyTicketPage from "../page";
import { ticketsApi, type MyAllocationConcert } from "@/lib/tickets-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", concertId: "concert-1" }),
}));

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      myList: vi.fn(),
      allocate: vi.fn(),
      updateAllocation: vi.fn(),
    },
  };
});

function makeConcert(overrides: Partial<MyAllocationConcert> = {}): MyAllocationConcert {
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
        outreachCount: 2,
        reportedAt: null,
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MyTicketPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("MyTicketPage（表示）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.myList).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("該当する演奏会が見つからない場合は案内メッセージを表示する", async () => {
    vi.mocked(ticketsApi.myList).mockResolvedValue([makeConcert({ concertId: "other" })]);
    renderPage();

    expect(await screen.findByText("チケット情報が見つかりません")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.myList).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("タイトル・開催日・BatchCard・情宣活動リンクを表示する", async () => {
    vi.mocked(ticketsApi.myList).mockResolvedValue([makeConcert()]);
    renderPage();

    expect(await screen.findByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("2026年11月23日")).toBeInTheDocument();
    expect(screen.getByText("一般")).toBeInTheDocument();
    expect(screen.getByText("情宣活動の申請・確認")).toBeInTheDocument();
    expect(screen.getByText("情宣回数")).toBeInTheDocument();
  });

  it("配布登録が0件の場合は案内メッセージを表示する", async () => {
    vi.mocked(ticketsApi.myList).mockResolvedValue([makeConcert({ batches: [] })]);
    renderPage();

    expect(await screen.findByText("配布登録されていません")).toBeInTheDocument();
  });

  it("締切済みの場合は締切メッセージを表示する", async () => {
    vi.mocked(ticketsApi.myList).mockResolvedValue([
      makeConcert({ ticketInputClosedAt: "2026-11-01T00:00:00+09:00" }),
    ]);
    renderPage();

    expect(await screen.findByText(/チケット入力は締め切られました/)).toBeInTheDocument();
  });

  it("レース結果公開時は結果リンクを表示する", async () => {
    vi.mocked(ticketsApi.myList).mockResolvedValue([
      makeConcert({ racePublishedAt: "2026-11-24T00:00:00+09:00" }),
    ]);
    renderPage();

    expect(await screen.findByText("チケットレース結果が公開されました")).toBeInTheDocument();
  });
});
