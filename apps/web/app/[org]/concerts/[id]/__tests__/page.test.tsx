import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConcertDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { concertsApi, type ConcertDetail } from "@/lib/concerts-api";
import { ApiClientError } from "@/lib/api-client";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

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
      updateStage: vi.fn(),
      addStage: vi.fn(),
      reorderStages: vi.fn(),
      getStructure: vi.fn(),
      addProgram: vi.fn(),
      deleteProgram: vi.fn(),
      listFiles: vi.fn(),
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
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

  it("取得エラー（404以外）はヘッダー付きで代わりの文言をalertで表示する", async () => {
    vi.mocked(concertsApi.get).mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "演奏会の読み込みに失敗しました。ページを再読み込みしてください。",
    );
    expect(screen.getByRole("heading", { name: "本番" })).toBeInTheDocument();
  });

  it("4xxの取得エラーはサーバーのメッセージを表示する", async () => {
    vi.mocked(concertsApi.get).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "権限がありません", 403),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("権限がありません");
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
    const dialog = screen.getByRole("dialog", { name: "演奏会を削除しますか？" });
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));
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

  it("削除中はEscで閉じず、キャンセルも押せない", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.delete).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("削除"));
    await user.click(screen.getByText("削除する"));
    await user.keyboard("{Escape}");

    const dialog = screen.getByRole("dialog", { name: "演奏会を削除しますか？" });
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });
});

describe("ConcertDetailPage（失敗の表示）", () => {
  it("削除に失敗したら確認を開いたままエラーを表示する", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.delete).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("削除"));
    await user.click(screen.getByText("削除する"));

    const dialog = screen.getByRole("dialog", { name: "演奏会を削除しますか？" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "演奏会の削除に失敗しました。もう一度お試しください。",
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "削除する" })).toBeEnabled();
  });

  it("ステージ名の保存に失敗したらエラーを表示し、入力した名前を残す", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.updateStage).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "入力値が不正です", 400),
    );
    const user = userEvent.setup();
    renderPage(["admin"]);

    const header = (await screen.findByText("第1ステージ")).closest("div") as HTMLElement;
    await user.click(within(header).getByTitle("名前を編集"));
    const input = screen.getByDisplayValue("第1ステージ");
    await user.clear(input);
    await user.type(input, "改称ステージ{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("入力値が不正です");
    expect(screen.getByDisplayValue("改称ステージ")).toBeInTheDocument();
  });

  it("ステージ名の保存に失敗したあと、編集を取り消すとエラーを消す", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.updateStage).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    const header = (await screen.findByText("第1ステージ")).closest("div") as HTMLElement;
    await user.click(within(header).getByTitle("名前を編集"));
    await user.type(screen.getByDisplayValue("第1ステージ"), "改{Enter}");
    await screen.findByRole("alert");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ステージ構成のエラーは、そのあとステージの追加に成功すると消える", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.updateStage).mockRejectedValue(new TypeError("Failed to fetch"));
    vi.mocked(concertsApi.addStage).mockResolvedValue({
      id: "stage-3",
      name: "第3ステージ",
      sortOrder: 2,
      programs: [],
    });
    const user = userEvent.setup();
    renderPage(["admin"]);

    const header = (await screen.findByText("第1ステージ")).closest("div") as HTMLElement;
    await user.click(within(header).getByTitle("名前を編集"));
    await user.type(screen.getByDisplayValue("第1ステージ"), "改{Enter}");
    await screen.findByRole("alert");
    await user.click(screen.getByText("ステージを追加"));
    await user.click(
      within(screen.getByRole("dialog", { name: "ステージを追加" })).getByText("追加する"),
    );

    expect(await screen.findByText("第3ステージ")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("移動で元の曲目の削除に失敗したら、移動先に追加した状態にして警告を表示する", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(
      makeConcert({
        stages: [
          {
            id: "stage-1",
            name: "第1ステージ",
            sortOrder: 0,
            programs: [{ id: "program-1", title: "1曲目", sortOrder: 0, score: null }],
          },
          { id: "stage-2", name: "第2ステージ", sortOrder: 1, programs: [] },
        ],
      }),
    );
    vi.mocked(concertsApi.getStructure).mockResolvedValue([
      {
        id: "concert-1",
        title: "第20回定期演奏会",
        stages: [
          { id: "stage-1", name: "第1ステージ", sortOrder: 0 },
          { id: "stage-2", name: "第2ステージ", sortOrder: 1 },
        ],
      },
    ]);
    vi.mocked(concertsApi.addProgram).mockResolvedValue({
      id: "program-new",
      title: "1曲目",
      sortOrder: 0,
      score: null,
    });
    vi.mocked(concertsApi.deleteProgram).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByTitle("移動 / コピー"));
    const dialog = screen.getByRole("dialog", { name: "移動 / コピー" });
    await user.selectOptions(
      await within(dialog).findByLabelText("移動先 / コピー先"),
      "concert-1::stage-2",
    );
    await user.click(within(dialog).getByText("移動する"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "移動先に追加しましたが、元の曲目を削除できませんでした。",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("1曲目")).toHaveLength(2);
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

describe("ConcertDetailPage（オンステ調査の管理操作の権限）", () => {
  it.each([["admin"], ["tech"], ["conductor"]])(
    "%s: 調査を開設するボタンを表示する",
    async (role) => {
      vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
      searchParamsMock = new URLSearchParams("tab=survey");
      renderPage([role]);

      expect(await screen.findByText("オンステ調査はまだ開設されていません")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "調査を開設する" })).toBeInTheDocument();
    },
  );

  it.each([["score"], ["member", "score"], ["member"]])(
    "%s: 調査を開設するボタンを表示しない",
    async (...roles) => {
      vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
      searchParamsMock = new URLSearchParams("tab=survey");
      renderPage(roles);

      expect(await screen.findByText("オンステ調査はまだ開設されていません")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "調査を開設する" })).not.toBeInTheDocument();
    },
  );
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

  it("visitorのみでも「ファイル」タブは表示される", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    renderPage(["visitor"]);

    await screen.findByText("第1ステージ");
    expect(screen.getByText("ファイル")).toBeInTheDocument();
  });
});

describe("ConcertDetailPage（ファイルタブ）", () => {
  it("「ファイル」タブクリックで添付ファイル一覧を表示する", async () => {
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.listFiles).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("ステージを追加");
    await user.click(screen.getByText("ファイル"));

    expect(await screen.findByText("登録されているファイルはありません")).toBeInTheDocument();
  });

  it("visitorのみで?tab=filesを指定するとファイルタブが表示される", async () => {
    searchParamsMock = new URLSearchParams("tab=files");
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.listFiles).mockResolvedValue([]);
    renderPage(["visitor"]);

    expect(await screen.findByText("登録されているファイルはありません")).toBeInTheDocument();
  });
});

// dnd-kitのドラッグ操作はjsdom上でpointer capture状態が後続テストのクリックに干渉するため、ファイル末尾に置く
describe("ConcertDetailPage（並び替えの失敗）", () => {
  it("ステージの並び替えの保存に失敗したらサーバーから取り直して元の順に戻し、エラーを表示する", async () => {
    mockPointerCapture();
    vi.mocked(concertsApi.get).mockResolvedValue(makeConcert());
    vi.mocked(concertsApi.reorderStages).mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage(["admin"]);

    dragAndDrop(
      await screen.findByLabelText("第1ステージをドラッグして並び替え"),
      screen.getByLabelText("第2ステージをドラッグして並び替え"),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "並び順の保存に失敗しました。元の順に戻しました。",
    );
    await waitFor(() => expect(concertsApi.get).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
        "第1ステージ",
        "第2ステージ",
      ]),
    );
  });

  it("並び替えの保存も取り直しも失敗したとき、画面を残して元の順に戻しエラーを表示する", async () => {
    mockPointerCapture();
    vi.mocked(concertsApi.get)
      .mockResolvedValueOnce(makeConcert())
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.mocked(concertsApi.reorderStages).mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage(["admin"]);

    dragAndDrop(
      await screen.findByLabelText("第1ステージをドラッグして並び替え"),
      screen.getByLabelText("第2ステージをドラッグして並び替え"),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("並び順の保存に失敗しました。");
    await waitFor(() => expect(concertsApi.get).toHaveBeenCalledTimes(2));
    expect(screen.getByText("ステージを追加")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "第1ステージ",
      "第2ステージ",
    ]);
  });
});
