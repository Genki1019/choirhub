import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BatchTab } from "../BatchTab";
import type { AllocationRow, BatchDetail, TicketDetail } from "@/lib/tickets-api";
import type { MemberProfile } from "@/lib/api-types";

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
    batches: [],
    partSummary: [],
    ...overrides,
  };
}

const defaultProps = {
  orgSlug: "o",
  concertId: "concert-1",
  allMembers: [] as MemberProfile[],
  onAllocationUpdated: () => {},
  onMemberAdded: () => {},
};

describe("BatchTab（集計カード）", () => {
  it("配布・販売・返却・集金の合計値を表示する", () => {
    const batch = makeBatch({
      allocations: [
        makeRow({
          id: "a1",
          allocatedCount: 10,
          soldAdult: 6,
          soldStudent: 1,
          returnedCount: 3,
          isCollected: true,
        }),
        makeRow({
          id: "a2",
          memberId: "member-2",
          nameJa: "鈴木花子",
          allocatedCount: 8,
          soldAdult: 0,
          soldStudent: 0,
          returnedCount: 0,
          isCollected: false,
        }),
      ],
    });
    render(<BatchTab batch={batch} detail={makeDetail({ batches: [batch] })} {...defaultProps} />);

    expect(screen.getByText("18枚")).toBeInTheDocument(); // 配布枚数 10+8
    expect(screen.getByText("7枚")).toBeInTheDocument(); // 販売済み 6+1+0
    expect(screen.getByText("3枚")).toBeInTheDocument(); // 返却済み
    expect(screen.getByText("1名")).toBeInTheDocument(); // 集金完了
  });
});

describe("BatchTab（パート別グルーピング）", () => {
  it("パート名ごとに見出しを分けて表示する", () => {
    const batch = makeBatch({
      allocations: [
        makeRow({ id: "a1", partName: "テノール1", nameJa: "山田太郎" }),
        makeRow({
          id: "a2",
          memberId: "member-2",
          partName: "ベース",
          partSortOrder: 2,
          partVoiceType: "bass1",
          nameJa: "鈴木花子",
        }),
      ],
    });
    render(<BatchTab batch={batch} detail={makeDetail({ batches: [batch] })} {...defaultProps} />);

    expect(screen.getAllByText("テノール1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ベース").length).toBeGreaterThan(0);
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("鈴木花子")).toBeInTheDocument();
  });

  it("パート未設定の行は「パート未設定」にまとめられる", () => {
    const batch = makeBatch({
      allocations: [makeRow({ partId: null, partName: null })],
    });
    render(<BatchTab batch={batch} detail={makeDetail({ batches: [batch] })} {...defaultProps} />);

    expect(screen.getByText("パート未設定")).toBeInTheDocument();
  });

  it("配布登録が0件の場合は案内メッセージを表示する", () => {
    const batch = makeBatch({ allocations: [] });
    render(<BatchTab batch={batch} detail={makeDetail({ batches: [batch] })} {...defaultProps} />);

    expect(screen.getByText("配布登録されていません")).toBeInTheDocument();
  });
});

describe("BatchTab（パート別集計）", () => {
  it("partSummaryが1件以上ある場合は集計セクションを表示する", () => {
    const batch = makeBatch();
    const detail = makeDetail({
      batches: [batch],
      partSummary: [
        { partId: "part-1", partName: "テノール1", allocated: 40, sold: 28, rate: 0.7 },
      ],
    });
    render(<BatchTab batch={batch} detail={detail} {...defaultProps} />);

    expect(screen.getByText("パート別集計")).toBeInTheDocument();
    expect(screen.getByText("28 / 40枚")).toBeInTheDocument();
  });

  it("partSummaryが0件の場合は集計セクションを表示しない", () => {
    const batch = makeBatch();
    render(<BatchTab batch={batch} detail={makeDetail({ batches: [batch] })} {...defaultProps} />);

    expect(screen.queryByText("パート別集計")).not.toBeInTheDocument();
  });
});

describe("BatchTab（団員を追加パネル）", () => {
  it("isAdmin: falseの場合はAddMemberPanelを表示しない", () => {
    const batch = makeBatch();
    const detail = makeDetail({ batches: [batch], isAdmin: false });
    const member: MemberProfile = {
      id: "member-2",
      nameJa: "未配布太郎",
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
    };
    render(<BatchTab batch={batch} detail={detail} {...defaultProps} allMembers={[member]} />);

    expect(screen.queryByText(/団員を追加/)).not.toBeInTheDocument();
  });
});
