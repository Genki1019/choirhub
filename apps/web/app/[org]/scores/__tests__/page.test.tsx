import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScoresPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { scoresApi, type GroupedScores } from "@/lib/scores-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return {
    ...actual,
    scoresApi: {
      grouped: vi.fn(),
    },
  };
});

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <ScoresPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

const emptyGrouped: GroupedScores = { concerts: [], unassigned: [] };

const fullGrouped: GroupedScores = {
  concerts: [
    {
      id: "concert-1",
      title: "第20回定期演奏会",
      heldOn: "2026-11-23",
      venue: "○○ホール",
      stages: [
        {
          id: "stage-1",
          name: "第1ステージ",
          sortOrder: 0,
          programs: [
            {
              id: "program-1",
              title: "",
              sortOrder: 0,
              score: {
                id: "score-1",
                title: "男声合唱のための〇〇",
                composer: "△△",
                arranger: null,
              },
            },
          ],
        },
      ],
    },
  ],
  unassigned: [{ id: "score-2", title: "□□の詩", composer: "◇◇", arranger: null }],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ScoresPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(scoresApi.grouped).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(scoresApi.grouped).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("演奏会・演奏会未定がいずれも0件の場合は空表示を出す", async () => {
    vi.mocked(scoresApi.grouped).mockResolvedValue(emptyGrouped);
    renderPage();

    expect(await screen.findByText("楽譜が登録されていません")).toBeInTheDocument();
  });
});

describe("ScoresPage（一覧表示）", () => {
  it("演奏会セクション・演奏会未定セクション・合計曲数を表示する", async () => {
    vi.mocked(scoresApi.grouped).mockResolvedValue(fullGrouped);
    renderPage();

    expect(await screen.findByText("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByText("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("演奏会未定")).toBeInTheDocument();
    expect(screen.getByText("□□の詩")).toBeInTheDocument();
    expect(screen.getByText("2曲")).toBeInTheDocument();
  });
});

describe("ScoresPage（曲目追加ボタンの権限）", () => {
  it("adminロール: 「曲目を追加」ボタンを表示する", async () => {
    vi.mocked(scoresApi.grouped).mockResolvedValue(emptyGrouped);
    renderPage(["admin"]);

    expect(await screen.findByText("曲目を追加")).toBeInTheDocument();
  });

  it("member等: 「曲目を追加」ボタンを表示しない", async () => {
    vi.mocked(scoresApi.grouped).mockResolvedValue(emptyGrouped);
    renderPage(["member"]);

    await screen.findByText("楽譜が登録されていません");
    expect(screen.queryByText("曲目を追加")).not.toBeInTheDocument();
  });

  it("「曲目を追加」クリックで追加モーダルを開き、キャンセルで閉じる", async () => {
    vi.mocked(scoresApi.grouped).mockResolvedValue(emptyGrouped);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("曲目を追加"));
    expect(screen.getByRole("heading", { name: "曲目を追加" })).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));
    expect(screen.queryByRole("heading", { name: "曲目を追加" })).not.toBeInTheDocument();
  });
});
