import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TicketDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { ticketsApi, type BatchDetail, type TicketDetail } from "@/lib/tickets-api";
import { membersApi } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", concertId: "concert-1" }),
}));

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      get: vi.fn(),
      closeTicketInput: vi.fn(),
      reopenTicketInput: vi.fn(),
      createBatch: vi.fn(),
      updateBatch: vi.fn(),
      deleteBatch: vi.fn(),
      listOutreachActivities: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return {
    ...actual,
    membersApi: {
      list: vi.fn().mockResolvedValue([]),
    },
  };
});

function makeBatch(overrides: Partial<BatchDetail> = {}): BatchDetail {
  return {
    id: "batch-1",
    name: "一般",
    price: 2000,
    priceStudent: null,
    totalCount: 100,
    saleStart: null,
    saleEnd: null,
    allocations: [],
    ...overrides,
  };
}

function makeDetail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    concert: {
      id: "concert-1",
      title: "第20回定期演奏会",
      heldOn: "2026-11-23",
      ticketInputClosedAt: null,
      outreachExpensePerTrip: null,
    },
    isAdmin: true,
    myMemberId: "member-self",
    batches: [makeBatch()],
    partSummary: [],
    ...overrides,
  };
}

function renderPage(roles: string[] = ["ticket"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <TicketDetailPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.list).mockResolvedValue([]);
  vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([]);
});

describe("TicketDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("403エラー時は権限エラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.get).mockRejectedValue(new ApiClientError("FORBIDDEN", "forbidden", 403));
    renderPage();

    expect(
      await screen.findByText("チケット担当者または管理者のみアクセスできます"),
    ).toBeInTheDocument();
  });

  it("403以外のエラー時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("演奏会名・日付を表示する", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage();

    expect(await screen.findByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("2026年11月23日")).toBeInTheDocument();
  });
});

describe("TicketDetailPage（締切バナー・締切/再開ボタン）", () => {
  it("ticketInputClosedAtが無い場合はバナーを表示せず「入力を締め切る」ボタンを表示する", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage();

    await screen.findByText("第20回定期演奏会");
    expect(screen.queryByText(/以降、団員の入力は締め切り済み/)).not.toBeInTheDocument();
    expect(screen.getByText("入力を締め切る")).toBeInTheDocument();
  });

  it("「入力を締め切る」クリックでcloseTicketInputが呼ばれバナーが表示される", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    vi.mocked(ticketsApi.closeTicketInput).mockResolvedValue({
      ticketInputClosedAt: "2026-11-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("入力を締め切る"));

    expect(ticketsApi.closeTicketInput).toHaveBeenCalledWith("tokyo-men-choir", "concert-1");
    expect(await screen.findByText(/以降、団員の入力は締め切り済み/)).toBeInTheDocument();
    expect(screen.getByText("入力を再開")).toBeInTheDocument();
  });

  it("締切済みの場合はバナーと「入力を再開」ボタンを表示し、クリックでreopenTicketInputが呼ばれる", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(
      makeDetail({
        concert: {
          id: "concert-1",
          title: "第20回定期演奏会",
          heldOn: "2026-11-23",
          ticketInputClosedAt: "2026-11-01T00:00:00+09:00",
          outreachExpensePerTrip: null,
        },
      }),
    );
    vi.mocked(ticketsApi.reopenTicketInput).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/以降、団員の入力は締め切り済み/)).toBeInTheDocument();
    await user.click(screen.getByText("入力を再開"));

    expect(ticketsApi.reopenTicketInput).toHaveBeenCalledWith("tokyo-men-choir", "concert-1");
    await waitFor(() =>
      expect(screen.queryByText(/以降、団員の入力は締め切り済み/)).not.toBeInTheDocument(),
    );
  });

  it("非adminの場合は締切/再開ボタンを表示しない", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail({ isAdmin: false }));
    renderPage(["member"]);

    await screen.findByText("第20回定期演奏会");
    expect(screen.queryByText("入力を締め切る")).not.toBeInTheDocument();
  });
});

describe("TicketDetailPage（席種タブ切替）", () => {
  it("席種が0件の場合は案内メッセージを表示する", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail({ batches: [] }));
    renderPage();

    expect(await screen.findByText("席種が登録されていません")).toBeInTheDocument();
    expect(screen.getByText("最初の席種を追加")).toBeInTheDocument();
  });

  it("複数の席種タブを切り替えられる", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(
      makeDetail({
        batches: [
          makeBatch({ id: "batch-1", name: "一般", price: 2000 }),
          makeBatch({ id: "batch-2", name: "学生", price: 1000 }),
        ],
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("配布登録されていません");
    expect(screen.getByText("¥2,000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^学生/ }));
    expect(screen.getByText("¥1,000")).toBeInTheDocument();
  });

  it("情宣交通費タブに切り替えるとOutreachExpenseTabが表示される", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("配布登録されていません");
    await user.click(screen.getByText("情宣交通費"));

    expect(await screen.findByText("情宣活動の申請がありません")).toBeInTheDocument();
  });
});

describe("TicketDetailPage（席種の追加・編集）", () => {
  it("「席種を追加」クリックでCreateBatchModalが開く", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("席種を追加"));
    expect(screen.getByText("席種を追加", { selector: "h2" })).toBeInTheDocument();
  });

  it("席種タブの✏️クリックでEditBatchModalが開く", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("配布登録されていません");
    await user.click(screen.getByTitle("席種を編集"));

    expect(screen.getByText("席種を編集", { selector: "h2" })).toBeInTheDocument();
  });

  it("非adminの場合は席種を編集する✏️を表示しない", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail({ isAdmin: false }));
    renderPage(["member"]);

    await screen.findByText("配布登録されていません");
    expect(screen.queryByTitle("席種を編集")).not.toBeInTheDocument();
  });
});

describe("TicketDetailPage（チケットレースリンク）", () => {
  it("「チケットレース」リンクの遷移先が正しい", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage();

    const link = await screen.findByText("チケットレース");
    expect(link.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/tickets/concert-1/race");
  });
});
