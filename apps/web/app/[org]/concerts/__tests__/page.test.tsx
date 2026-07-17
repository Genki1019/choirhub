import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConcertsPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { concertsApi, type ConcertSummary } from "@/lib/concerts-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      list: vi.fn(),
    },
  };
});

function makeConcert(overrides: Partial<ConcertSummary> = {}): ConcertSummary {
  return {
    id: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    venue: "○○ホール",
    status: "draft",
    stageCount: 2,
    programCount: 8,
    hasSurvey: false,
    surveyOpen: false,
    linkedEventId: null,
    ...overrides,
  };
}

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <ConcertsPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ConcertsPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(concertsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.list).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("0件の場合は空表示を出す", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("演奏会が登録されていません")).toBeInTheDocument();
  });
});

describe("ConcertsPage（一覧表示・並び順）", () => {
  it("演奏会カードと件数を表示する", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([makeConcert()]);
    renderPage();

    expect(await screen.findByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("1件")).toBeInTheDocument();
  });

  it("statusがpastの演奏会は末尾に表示される", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([
      makeConcert({ id: "c-past", title: "past演奏会", status: "past" }),
      makeConcert({ id: "c-draft", title: "draft演奏会", status: "draft" }),
    ]);
    renderPage();

    await screen.findByText("past演奏会");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((el) => el.textContent);
    expect(titles).toEqual(["draft演奏会", "past演奏会"]);
  });
});

describe("ConcertsPage（フィルタ）", () => {
  it("フィルタチップをクリックすると該当statusのみ表示する", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([
      makeConcert({ id: "c-draft", title: "準備中演奏会", status: "draft" }),
      makeConcert({ id: "c-confirmed", title: "確定演奏会", status: "confirmed" }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("準備中演奏会");
    await user.click(screen.getByRole("button", { name: "確定済み" }));

    expect(screen.getByText("確定演奏会")).toBeInTheDocument();
    expect(screen.queryByText("準備中演奏会")).not.toBeInTheDocument();
  });
});

describe("ConcertsPage（演奏会を登録ボタンの権限）", () => {
  it("adminロール: 「演奏会を登録」ボタンを表示する", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([]);
    renderPage(["admin"]);

    const link = await screen.findByText("演奏会を登録");
    expect(link.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/concerts/new");
  });

  it("member等: 「演奏会を登録」ボタンを表示しない", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([]);
    renderPage(["member"]);

    await screen.findByText("演奏会が登録されていません");
    expect(screen.queryByText("演奏会を登録")).not.toBeInTheDocument();
  });
});

describe("ConcertCard", () => {
  it("ステータス・日付・会場・ステージ数・曲数を表示し、詳細へリンクする", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([makeConcert({ status: "survey_open" })]);
    renderPage();

    await screen.findByText("第20回定期演奏会");
    expect(screen.getAllByText("調査中").length).toBeGreaterThan(0);
    expect(screen.getByText("2026年11月23日")).toBeInTheDocument();
    expect(screen.getByText("○○ホール")).toBeInTheDocument();
    expect(screen.getByText("2ステージ")).toBeInTheDocument();
    expect(screen.getByText("8曲")).toBeInTheDocument();
    expect(screen.getByText("第20回定期演奏会").closest("a")).toHaveAttribute(
      "href",
      "/tokyo-men-choir/concerts/concert-1",
    );
  });

  it("surveyOpen: trueの場合は「調査受付中」バッジを表示する", async () => {
    vi.mocked(concertsApi.list).mockResolvedValue([makeConcert({ surveyOpen: true })]);
    renderPage();

    expect(await screen.findByText("調査受付中")).toBeInTheDocument();
  });
});
