import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewProgramPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { concertsApi, type ConcertDetail } from "@/lib/concerts-api";
import { scoresApi } from "@/lib/scores-api";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
let searchParamsMock = new URLSearchParams({ stageId: "stage-1" });

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
      addProgram: vi.fn(),
    },
  };
});

vi.mock("@/lib/scores-api", () => ({
  scoresApi: {
    list: vi.fn(),
  },
}));

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

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <NewProgramPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  searchParamsMock = new URLSearchParams({ stageId: "stage-1" });
  vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
  vi.mocked(scoresApi.list).mockResolvedValue([]);
});

describe("NewProgramPage（権限・表示状態）", () => {
  it.each([["member"], ["tech"], ["score"]])(
    "%sロール: アクセス権限がありませんと表示する",
    async (role) => {
      renderPage([role]);
      expect(
        await screen.findByText("このページにアクセスする権限がありません"),
      ).toBeInTheDocument();
    },
  );

  it("admin: ローディング中は「読み込み中...」を表示する", () => {
    vi.mocked(concertsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("stageIdに一致するステージが無い場合はステージが見つかりませんと表示する", async () => {
    searchParamsMock = new URLSearchParams({ stageId: "stage-unknown" });
    renderPage();
    expect(await screen.findByText("ステージが見つかりません")).toBeInTheDocument();
  });

  it("admin: ステージ名を表示し、新しく作成タブがデフォルトで表示される", async () => {
    renderPage();
    expect(await screen.findByText("第1ステージ")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/男声合唱のための/)).toBeInTheDocument();
  });
});

describe("NewProgramPage（新しく作成）", () => {
  it("曲名が空の場合はエラーを表示し追加しない", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("第1ステージ");

    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(await screen.findByText("曲名を入力してください")).toBeInTheDocument();
    expect(concertsApi.addProgram).not.toHaveBeenCalled();
  });

  it("曲名を入力して追加すると、ステージ構成タブへ戻る", async () => {
    const user = userEvent.setup();
    vi.mocked(concertsApi.addProgram).mockResolvedValue({
      id: "program-1",
      title: "新曲",
      sortOrder: 0,
      score: null,
    });
    renderPage();
    await screen.findByText("第1ステージ");

    await user.type(screen.getByPlaceholderText(/男声合唱のための/), "新曲");
    await user.click(screen.getByRole("button", { name: "追加する" }));

    await waitFor(() =>
      expect(concertsApi.addProgram).toHaveBeenCalledWith(
        "tokyo-men-choir",
        "concert-1",
        "stage-1",
        { title: "新曲", composer: null, arranger: null },
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/concerts/concert-1?tab=stages");
  });
});

describe("NewProgramPage（既存から選ぶ）", () => {
  it("タブ切り替えで楽譜検索を行い、未選択なら追加できない", async () => {
    const user = userEvent.setup();
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "既存曲A", composer: "作曲家A", arranger: null },
    ]);
    renderPage();
    await screen.findByText("第1ステージ");

    await user.click(screen.getByRole("button", { name: "既存から選ぶ" }));

    expect(await screen.findByText("既存曲A")).toBeInTheDocument();
    expect(scoresApi.list).toHaveBeenCalledWith("tokyo-men-choir", { q: "" });

    await user.click(screen.getByRole("button", { name: "追加する" }));
    expect(await screen.findByText("楽譜を選択してください")).toBeInTheDocument();
  });

  it("検索語を入力するとデバウンス後にqパラメータ付きで再検索する", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("第1ステージ");
    await user.click(screen.getByRole("button", { name: "既存から選ぶ" }));
    await waitFor(() => expect(scoresApi.list).toHaveBeenCalledWith("tokyo-men-choir", { q: "" }));

    await user.type(screen.getByPlaceholderText("曲名・作曲者・編曲者で検索..."), "田中");

    await waitFor(
      () => expect(scoresApi.list).toHaveBeenCalledWith("tokyo-men-choir", { q: "田中" }),
      { timeout: 1000 },
    );
  });

  it("楽譜を選択して追加すると、scoreIdを指定して登録する", async () => {
    const user = userEvent.setup();
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "既存曲A", composer: "作曲家A", arranger: null },
    ]);
    vi.mocked(concertsApi.addProgram).mockResolvedValue({
      id: "program-1",
      title: "既存曲A",
      sortOrder: 0,
      score: { id: "score-1", composer: "作曲家A", arranger: null },
    });
    renderPage();
    await screen.findByText("第1ステージ");

    await user.click(screen.getByRole("button", { name: "既存から選ぶ" }));
    await user.click(await screen.findByText("既存曲A"));
    await user.click(screen.getByRole("button", { name: "追加する" }));

    await waitFor(() =>
      expect(concertsApi.addProgram).toHaveBeenCalledWith(
        "tokyo-men-choir",
        "concert-1",
        "stage-1",
        { scoreId: "score-1" },
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/concerts/concert-1?tab=stages");
  });
});
