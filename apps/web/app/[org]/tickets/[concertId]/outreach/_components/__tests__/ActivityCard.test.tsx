import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityCard } from "../ActivityCard";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
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

describe("ActivityCard（表示）", () => {
  it("行き先・日付・参加者数・販売数・交通費を表示する", () => {
    render(
      <ActivityCard
        activity={makeActivity()}
        myMemberId="member-1"
        isAdmin={false}
        orgSlug="o"
        concertId="concert-1"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByText("渋谷駅前")).toBeInTheDocument();
    expect(screen.getByText("2026/05/10")).toBeInTheDocument();
    expect(screen.getByText("1名")).toBeInTheDocument();
    expect(screen.getByText("3枚")).toBeInTheDocument();
    expect(screen.getByText("¥500")).toBeInTheDocument();
  });

  it("支払済みの活動には「支払済」バッジが表示される", () => {
    render(
      <ActivityCard
        activity={makeActivity({ status: "paid" })}
        myMemberId="member-1"
        isAdmin={false}
        orgSlug="o"
        concertId="concert-1"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByText("支払済")).toBeInTheDocument();
  });

  it("申請者本人でもadminでもない場合は削除ボタンを表示しない", () => {
    render(
      <ActivityCard
        activity={makeActivity({ createdById: "other-member" })}
        myMemberId="member-1"
        isAdmin={false}
        orgSlug="o"
        concertId="concert-1"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("渋谷駅前を削除")).not.toBeInTheDocument();
  });

  it("adminの場合は申請者本人でなくても削除ボタンを表示する", () => {
    render(
      <ActivityCard
        activity={makeActivity({ createdById: "other-member" })}
        myMemberId="member-1"
        isAdmin={true}
        orgSlug="o"
        concertId="concert-1"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("渋谷駅前を削除")).toBeInTheDocument();
  });
});

describe("ActivityCard（展開）", () => {
  it("クリックで参加者テーブルが展開表示される", async () => {
    const user = userEvent.setup();
    render(
      <ActivityCard
        activity={makeActivity()}
        myMemberId="member-1"
        isAdmin={false}
        orgSlug="o"
        concertId="concert-1"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.queryByText("申請者: 田中太郎")).not.toBeInTheDocument();

    await user.click(screen.getByText("渋谷駅前"));
    expect(screen.getByText("申請者: 田中太郎")).toBeInTheDocument();
  });
});

describe("ActivityCard（削除操作）", () => {
  it("確認ダイアログでキャンセルすると削除されない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(
      <ActivityCard
        activity={makeActivity()}
        myMemberId="member-1"
        isAdmin={false}
        orgSlug="o"
        concertId="concert-1"
        onDeleted={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("渋谷駅前を削除"));
    expect(ticketsApi.deleteOutreachActivity).not.toHaveBeenCalled();
  });

  it("確認ダイアログで同意すると削除されonDeletedが呼ばれる", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(ticketsApi.deleteOutreachActivity).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityCard
        activity={makeActivity()}
        myMemberId="member-1"
        isAdmin={false}
        orgSlug="o"
        concertId="concert-1"
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByLabelText("渋谷駅前を削除"));

    expect(ticketsApi.deleteOutreachActivity).toHaveBeenCalledWith("o", "concert-1", "activity-1");
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("activity-1"));
  });
});
