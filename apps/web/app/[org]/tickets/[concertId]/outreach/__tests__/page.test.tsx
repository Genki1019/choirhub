import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OutreachPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { ticketsApi, type OutreachActivityRow, type TicketDetail } from "@/lib/tickets-api";
import { membersApi } from "@/lib/members-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", concertId: "concert-1" }),
}));

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      listOutreachActivities: vi.fn(),
      get: vi.fn(),
      deleteOutreachActivity: vi.fn(),
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
    participants: [],
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
    isAdmin: false,
    myMemberId: "member-1",
    batches: [],
    partSummary: [],
    ...overrides,
  };
}

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-1" roles={roles}>
        <OutreachPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.list).mockResolvedValue([]);
});

describe("OutreachPage（表示）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockReturnValue(new Promise(() => {}));
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockRejectedValue(new Error("取得に失敗しました"));
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("0件の場合は案内メッセージを表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([]);
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage();

    expect(await screen.findByText("情宣活動の申請がありません")).toBeInTheDocument();
  });

  it("演奏会タイトルとActivityCard一覧を表示する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([makeActivity()]);
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    renderPage();

    expect(await screen.findByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("渋谷駅前")).toBeInTheDocument();
  });
});

describe("OutreachPage（新規申請）", () => {
  it("「新規申請」クリックでCreateModalが開く", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue([]);
    vi.mocked(ticketsApi.get).mockResolvedValue(makeDetail());
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("情宣活動の申請がありません");
    await user.click(screen.getByText("新規申請"));

    expect(screen.getByText("情宣活動を申請")).toBeInTheDocument();
  });
});
