import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TicketDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import {
  ticketsApi,
  type AllocationRow,
  type BatchDetail,
  type TicketDetail,
} from "@/lib/tickets-api";
import { membersApi } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import type { MemberProfile } from "@/lib/api-types";

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
      allocate: vi.fn(),
      updateAllocation: vi.fn(),
      listOutreachActivities: vi
        .fn()
        .mockResolvedValue({ concert: { id: "concert-1", title: "" }, activities: [] }),
      exportCsv: vi.fn(),
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

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: null,
    nameEn: null,
    avatarUrl: null,
    part: null,
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: null,
    ...overrides,
  };
}

function makeRow(overrides: Partial<AllocationRow> = {}): AllocationRow {
  return {
    id: "alloc-1",
    batchId: "batch-1",
    memberId: "member-1",
    requestedCount: null,
    nameJa: "山田太郎",
    partId: "part-1",
    partName: "テノール1",
    partSortOrder: 1,
    partVoiceType: "tenor1",
    allocatedCount: 10,
    soldAdult: 6,
    soldStudent: 1,
    soldOther: 0,
    returnedCount: 3,
    outreachCount: 0,
    isOutreachExpensePaid: false,
    outreachExpensePaidAt: null,
    isCollected: true,
    reportedAt: null,
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
  vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue({
    concert: { id: "concert-1", title: "" },
    activities: [],
  });
});

describe("TicketDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("403エラー時は権限エラーメッセージだけを表示し、管理用の操作も団員一覧の取得も出さない", async () => {
    vi.mocked(ticketsApi.get).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "チケット担当者または管理者のみアクセスできます", 403),
    );
    renderPage();

    expect(
      await screen.findByText("チケット担当者または管理者のみアクセスできます"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /入力を締め切る|CSV出力|席種を追加/ })).toBeNull();
    expect(membersApi.list).not.toHaveBeenCalled();
  });

  it("403以外のエラー時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.get).mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "チケット情報の読み込みに失敗しました。ページを再読み込みしてください。",
    );
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
});

describe("TicketDetailPage（CSV出力）", () => {
  it("adminの場合は「CSV出力」クリックで配券・販売実績CSVをダウンロードする", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    vi.mocked(ticketsApi.exportCsv).mockResolvedValue();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "CSV出力" }));
    expect(ticketsApi.exportCsv).toHaveBeenCalledWith("tokyo-men-choir", "concert-1");
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

  it("席種の編集ボタンは常に見え、席種名入りの名前を持つ。追加ボタンにも名前がある", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage(["admin"]);

    const edit = await screen.findByRole("button", { name: "席種「一般」を編集" });
    expect(edit).not.toHaveClass("opacity-0");
    expect(screen.getByRole("button", { name: "席種を追加" })).toBeInTheDocument();
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

describe("TicketDetailPage（入力の締め切りの失敗）", () => {
  it("締め切りに失敗したらエラーを表示し、締め切っていない状態のままにする", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    vi.mocked(ticketsApi.closeTicketInput).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("入力を締め切る"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "入力の締め切りに失敗しました。もう一度お試しください。",
    );
    expect(screen.queryByText(/以降、団員の入力は締め切り済み/)).not.toBeInTheDocument();
  });
});

describe("TicketDetailPage（席種の削除・団員の追加のあと）", () => {
  it("席種を削除すると「席種を追加」ボタンにフォーカスが移る", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(
      makeDetail({ batches: [makeBatch(), makeBatch({ id: "batch-2", name: "学生" })] }),
    );
    vi.mocked(ticketsApi.deleteBatch).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "席種「一般」を編集" }));
    await user.click(screen.getByText("この席種を削除"));
    await user.click(screen.getByText("削除する"));

    await waitFor(() => expect(screen.getByRole("button", { name: "席種を追加" })).toHaveFocus());
  });

  it("団員を追加すると、販売数などをサーバーから取り直す", async () => {
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    vi.mocked(ticketsApi.allocate).mockResolvedValue({
      id: "alloc-new",
      batchId: "batch-1",
      memberId: "member-1",
      allocatedCount: 0,
      requestedCount: null,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("団員を追加（1名未配布）"));
    await user.selectOptions(screen.getByRole("combobox"), "member-1");
    await user.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(ticketsApi.get).toHaveBeenCalledTimes(2));
  });

  it("追加後の取り直しに失敗しても画面は残し、上部にエラーを表示する", async () => {
    vi.mocked(ticketsApi.get)
      .mockResolvedValueOnce(makeDetail())
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    vi.mocked(ticketsApi.allocate).mockResolvedValue({
      id: "alloc-new",
      batchId: "batch-1",
      memberId: "member-1",
      allocatedCount: 0,
      requestedCount: null,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("団員を追加（1名未配布）"));
    await user.selectOptions(screen.getByRole("combobox"), "member-1");
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "最新のチケット情報の読み込みに失敗しました。",
    );
    expect(screen.getByRole("button", { name: "席種を追加" })).toBeInTheDocument();
  });

  it("取り直しの途中で別の行を保存したら、古い取得結果で上書きせずに取り直し直す", async () => {
    const detail = makeDetail({ batches: [makeBatch({ allocations: [makeRow()] })] });
    let resolveSecond: (d: typeof detail) => void = () => {};
    vi.mocked(ticketsApi.get)
      .mockResolvedValueOnce(detail)
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)))
      .mockResolvedValue(detail);
    vi.mocked(membersApi.list).mockResolvedValue([makeMember({ id: "member-9" })]);
    vi.mocked(ticketsApi.allocate).mockResolvedValue({
      id: "alloc-new",
      batchId: "batch-1",
      memberId: "member-9",
      allocatedCount: 0,
      requestedCount: null,
    });
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue(makeRow());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("団員を追加（1名未配布）"));
    await user.selectOptions(screen.getByRole("combobox"), "member-9");
    await user.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() => expect(ticketsApi.get).toHaveBeenCalledTimes(2));

    await user.click(screen.getByLabelText(/の販売状況を編集$/));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(ticketsApi.get).toHaveBeenCalledTimes(3));
    resolveSecond(detail);
  });
});
