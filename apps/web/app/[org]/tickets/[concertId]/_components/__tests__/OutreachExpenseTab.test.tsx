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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OutreachExpenseTab（表示）", () => {
  it("読み込み中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockReturnValue(new Promise(() => {}));
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("0件の場合は案内メッセージを表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([]);
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

    expect(await screen.findByText("情宣活動の申請がありません")).toBeInTheDocument();
  });

  it("申請件数・未払い件数・未払い交通費合計を表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([
      makeActivity({ id: "a1", status: "pending" }),
      makeActivity({ id: "a2", status: "paid" }),
    ]);
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

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
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

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
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

    await screen.findByText("渋谷駅前");
    expect(screen.getByText("支払済")).toBeInTheDocument();
    expect(screen.queryByText("支払済みにする")).not.toBeInTheDocument();
  });
});

describe("OutreachExpenseTab（支払い操作）", () => {
  it("「支払済みにする」クリックでpayOutreachActivityが呼ばれステータスが更新される", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    vi.mocked(ticketsApi.payOutreachActivity).mockResolvedValue(makeActivity({ status: "paid" }));
    const user = userEvent.setup();
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

    await user.click(await screen.findByText("支払済みにする"));

    expect(ticketsApi.payOutreachActivity).toHaveBeenCalledWith("o", "concert-1", "activity-1");
    expect(await screen.findByText("支払済")).toBeInTheDocument();
  });
});

describe("OutreachExpenseTab（削除操作）", () => {
  it("確認ダイアログでキャンセルすると削除されない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    const user = userEvent.setup();
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

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
    render(<OutreachExpenseTab orgSlug="o" concertId="concert-1" />);

    await screen.findByText("渋谷駅前");
    const deleteButton = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-trash2"))!;
    await user.click(deleteButton);

    expect(ticketsApi.deleteOutreachActivity).toHaveBeenCalledWith("o", "concert-1", "activity-1");
    await waitFor(() => expect(screen.queryByText("渋谷駅前")).not.toBeInTheDocument());
  });
});
