import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConcertDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { concertsApi, type ConcertDetail } from "@/lib/concerts-api";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
let searchParamsMock = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", id: "concert-1" }),
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}));

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      get: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function makeConcert(overrides: Partial<ConcertDetail> = {}): ConcertDetail {
  return {
    id: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23T14:00:00+09:00",
    venue: "○○ホール",
    status: "draft",
    linkedEventId: null,
    stages: [
      { id: "stage-1", name: "第1ステージ", sortOrder: 0, programs: [] },
      { id: "stage-2", name: "第2ステージ", sortOrder: 1, programs: [] },
    ],
    surveys: [],
    appliedSurveyId: null,
    assignments: [],
    ...overrides,
  };
}

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <ConcertDetailPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  searchParamsMock = new URLSearchParams();
});

describe("ConcertDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(concertsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー（404以外）はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("演奏会名・ステータス・日付・会場・ステージ数・曲数を表示する", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage();

    expect(await screen.findByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("準備中")).toBeInTheDocument();
    expect(screen.getByText("○○ホール")).toBeInTheDocument();
    expect(screen.getByText("2 ステージ")).toBeInTheDocument();
    expect(screen.getByText("0 曲")).toBeInTheDocument();
  });
});

describe("ConcertDetailPage（編集・削除ボタンの権限）", () => {
  it("adminロール: 編集・削除ボタンを表示する", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["admin"]);

    expect(await screen.findByText("編集")).toBeInTheDocument();
    expect(screen.getByText("削除")).toBeInTheDocument();
  });

  it("tech等: 編集・削除ボタンを表示しない", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["tech"]);

    await screen.findByText("第20回定期演奏会");
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
    expect(screen.queryByText("削除")).not.toBeInTheDocument();
  });

  it("編集ボタンクリックで編集モーダルを開く", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("編集"));
    expect(screen.getByText("演奏会情報を編集")).toBeInTheDocument();
  });

  it("削除ボタンクリックで確認ダイアログを表示し、キャンセルで閉じる", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("削除"));
    expect(screen.getByText("演奏会を削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));
    expect(screen.queryByText("演奏会を削除しますか？")).not.toBeInTheDocument();
  });

  it("削除を確定するとconcertsApi.deleteが呼ばれ一覧へ遷移する", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.delete).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("削除"));
    await user.click(screen.getByText("削除する"));

    await waitFor(() =>
      expect(concertsApi.delete).toHaveBeenCalledWith("tokyo-men-choir", "concert-1"),
    );
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/concerts");
  });
});

describe("ConcertDetailPage（タブ切替）", () => {
  it("初期表示は「ステージ構成」タブ", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["admin"]);

    expect(await screen.findByText("ステージを追加")).toBeInTheDocument();
  });

  it("「オンステ調査」タブクリックで内容が切り替わる", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("ステージを追加");
    await user.click(screen.getByText("オンステ調査"));

    expect(await screen.findByText("オンステ調査はまだ開設されていません")).toBeInTheDocument();
  });

  it("URLの?tabパラメータで初期タブを指定できる", async () => {
    searchParamsMock = new URLSearchParams("tab=onstage");
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["admin"]);

    expect(
      await screen.findByText(
        "オンステ確定後に、出演メンバーとフォーメーションがここに表示されます",
      ),
    ).toBeInTheDocument();
  });
});

describe("ConcertDetailPage（visitorのタブ制御）", () => {
  it("visitorのみの場合は「オンステ調査」「出演メンバー」タブを表示しない", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["visitor"]);

    await screen.findByText("第1ステージ");
    expect(screen.queryByText("オンステ調査")).not.toBeInTheDocument();
    expect(screen.queryByText("出演メンバー")).not.toBeInTheDocument();
  });

  it("visitorのみで?tab=surveyを指定してもステージ構成タブが表示される", async () => {
    searchParamsMock = new URLSearchParams("tab=survey");
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["visitor"]);

    expect(await screen.findByText("第1ステージ")).toBeInTheDocument();
  });

  it("visitor + memberロール併用時は3タブとも表示する", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["visitor", "member"]);

    await screen.findByText("第1ステージ");
    expect(screen.getByText("オンステ調査")).toBeInTheDocument();
    expect(screen.getByText("出演メンバー")).toBeInTheDocument();
  });
});
