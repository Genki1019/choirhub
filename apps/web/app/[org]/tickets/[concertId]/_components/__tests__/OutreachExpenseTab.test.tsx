import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutreachExpenseTab } from "../OutreachExpenseTab";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      listOutreachActivities: vi.fn(),
      payOutreachActivity: vi.fn(),
      unpayOutreachActivity: vi.fn(),
      deleteOutreachActivity: vi.fn(),
    },
  };
});

function makeActivity(overrides: Partial<OutreachActivityRow> = {}): OutreachActivityRow {
  return {
    id: "activity-1",
    concertId: "concert-1",
    destination: "渋谷駅前",
    activityDate: "2026-05-10",
    note: null,
    status: "pending",
    paidAt: null,
    createdById: "member-1",
    creatorName: "田中太郎",
    createdAt: "2026-05-10T00:00:00+09:00",
    participants: [
      {
        id: "p1",
        memberId: "member-1",
        memberName: "田中太郎",
        partId: "part-1",
        partName: "テノール1",
        ticketsSold: 3,
        expense: 500,
      },
    ],
    ...overrides,
  };
}

function renderTab() {
  return render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OutreachExpenseTab（表示）", () => {
  it("読み込み中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockReturnValue(new Promise(() => {}));
    renderTab();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("0件の場合は案内メッセージを表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([]);
    renderTab();

    expect(await screen.findByText("情宣活動の申請がありません")).toBeInTheDocument();
  });

  it("申請件数・未払い件数・未払い交通費合計を表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([
      makeActivity({ id: "a1", status: "pending" }),
      makeActivity({ id: "a2", status: "paid" }),
    ]);
    renderTab();

    await screen.findAllByText("渋谷駅前");
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "2件"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "1件"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "¥500"),
    ).toBeInTheDocument();
  });

  it("活動の行き先・ステータス・日付・参加者数・申請者を表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    renderTab();

    await screen.findByText("渋谷駅前");
    expect(screen.getAllByText("未払い").length).toBeGreaterThan(0);
    expect(screen.getByText("1名")).toBeInTheDocument();
    expect(screen.getByText("申請: 田中太郎")).toBeInTheDocument();
    expect(screen.getByText(/テノール1/)).toBeInTheDocument();
  });

  it("支払済みの活動には「支払済」バッジが表示され、支払済みボタンは表示されない", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([
      makeActivity({ status: "paid" }),
    ]);
    renderTab();

    await screen.findByText("渋谷駅前");
    expect(screen.getByText("支払済")).toBeInTheDocument();
    expect(screen.queryByText("支払済みにする")).not.toBeInTheDocument();
  });
});

describe("OutreachExpenseTab（支払い・取り消し操作）", () => {
  it("「支払済みにする」クリックでpayOutreachActivityが呼ばれステータスが更新される", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    vi.mocked(ticketsApi.payOutreachActivity).mockResolvedValue(makeActivity({ status: "paid" }));
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByText("支払済みにする"));

    expect(ticketsApi.payOutreachActivity).toHaveBeenCalledWith("o", "concert-1", "activity-1");
    expect(await screen.findByText("支払済")).toBeInTheDocument();
  });

  it("支払い記録に失敗した場合、エラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    vi.mocked(ticketsApi.payOutreachActivity).mockRejectedValue(new Error("支払いに失敗しました"));
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByText("支払済みにする"));

    expect(await screen.findByText("支払いに失敗しました")).toBeInTheDocument();
  });

  it("支払済みの活動には「未払いに戻す」ボタンが表示される", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([
      makeActivity({ status: "paid" }),
    ]);
    renderTab();

    expect(await screen.findByText("未払いに戻す")).toBeInTheDocument();
  });

  it("「未払いに戻す」クリックでunpayOutreachActivityが呼ばれステータスが戻る", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([
      makeActivity({ status: "paid" }),
    ]);
    vi.mocked(ticketsApi.unpayOutreachActivity).mockResolvedValue(
      makeActivity({ status: "pending" }),
    );
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByText("未払いに戻す"));

    expect(ticketsApi.unpayOutreachActivity).toHaveBeenCalledWith("o", "concert-1", "activity-1");
    await waitFor(() => expect(screen.getByText("支払済みにする")).toBeInTheDocument());
  });

  it("取り消しに失敗した場合、エラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([
      makeActivity({ status: "paid" }),
    ]);
    vi.mocked(ticketsApi.unpayOutreachActivity).mockRejectedValue(
      new Error("取り消しに失敗しました"),
    );
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByText("未払いに戻す"));

    expect(await screen.findByText("取り消しに失敗しました")).toBeInTheDocument();
  });

  it("取り消し処理中は未払いに戻すボタンがdisabledになる", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([
      makeActivity({ status: "paid" }),
    ]);
    let resolveUnpay: (activity: OutreachActivityRow) => void;
    vi.mocked(ticketsApi.unpayOutreachActivity).mockReturnValue(
      new Promise((resolve) => {
        resolveUnpay = resolve;
      }),
    );
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByText("未払いに戻す"));
    expect(screen.getByText("未払いに戻す").closest("button")).toBeDisabled();

    resolveUnpay!(makeActivity({ status: "paid" }));
    await waitFor(() => expect(screen.getByText("未払いに戻す").closest("button")).toBeEnabled());
  });
});

describe("OutreachExpenseTab（削除操作）", () => {
  it("確認ダイアログでキャンセルすると削除されない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("渋谷駅前");
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!;
    await user.click(deleteButton);

    expect(ticketsApi.deleteOutreachActivity).not.toHaveBeenCalled();
    expect(screen.getByText("渋谷駅前")).toBeInTheDocument();
  });

  it("確認ダイアログで同意すると削除される", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    vi.mocked(ticketsApi.deleteOutreachActivity).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("渋谷駅前");
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!;
    await user.click(deleteButton);

    expect(ticketsApi.deleteOutreachActivity).toHaveBeenCalledWith("o", "concert-1", "activity-1");
    await waitFor(() => expect(screen.queryByText("渋谷駅前")).not.toBeInTheDocument());
  });

  it("削除に失敗した場合、エラーメッセージを表示する", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    vi.mocked(ticketsApi.deleteOutreachActivity).mockRejectedValue(new Error("削除できません"));
    const user = userEvent.setup();
    renderTab();

    await screen.findByText("渋谷駅前");
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!;
    await user.click(deleteButton);

    expect(await screen.findByText("削除できません")).toBeInTheDocument();
  });
});
