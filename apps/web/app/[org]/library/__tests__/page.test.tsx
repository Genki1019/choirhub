import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LibraryPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { documentsApi, type OrgDocument } from "@/lib/documents-api";
import { filesApi, type CrossFileItem } from "@/lib/files-api";
import { ApiClientError } from "@/lib/api-client";
import { concertsApi, type ConcertSummary } from "@/lib/concerts-api";
import { scoresApi, type ScoreDetail } from "@/lib/scores-api";
import { membersApi } from "@/lib/members-api";

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/documents-api")>("@/lib/documents-api");
  return {
    ...actual,
    documentsApi: {
      list: vi.fn(),
      upload: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock("@/lib/files-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/files-api")>("@/lib/files-api");
  return {
    ...actual,
    filesApi: {
      list: vi.fn(),
    },
  };
});

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: { list: vi.fn(), listFiles: vi.fn(), uploadFile: vi.fn(), deleteFile: vi.fn() },
  };
});

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return { ...actual, scoresApi: { list: vi.fn(), getDetail: vi.fn() } };
});

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return { ...actual, membersApi: { parts: vi.fn() } };
});

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <LibraryPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

const sampleDoc: OrgDocument = {
  id: "doc-1",
  title: "団則",
  category: "bylaws",
  accessLevel: "restricted",
  fileName: "bylaws.pdf",
  downloadUrl: "/api/v1/tokyo-men-choir/documents/doc-1/download",
};

beforeEach(() => {
  vi.resetAllMocks();
  searchParams = new URLSearchParams();
});

describe("LibraryPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(documentsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得の失敗が4xxならAPIの理由を読み上げる形で表示する", async () => {
    vi.mocked(documentsApi.list).mockRejectedValue(
      new ApiClientError("NOT_INVITED", "閲覧する権限がありません", 403),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("閲覧する権限がありません");
  });

  it("取得の失敗が5xxでも空でない文言を表示する", async () => {
    vi.mocked(documentsApi.list).mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "資料の読み込みに失敗しました。ページを再読み込みしてください。",
    );
  });

  it("0件の場合は空表示を出す", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("登録されている資料はありません")).toBeInTheDocument();
  });
});

describe("LibraryPage（一覧表示）", () => {
  it("タイトル・ファイル名・accessLevelバッジを表示する", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([sampleDoc]);
    renderPage();

    expect(await screen.findByText("団則")).toBeInTheDocument();
    expect(screen.getByText("bylaws.pdf")).toBeInTheDocument();
    expect(screen.getByText("団員限定")).toBeInTheDocument();
  });
});

describe("LibraryPage（カテゴリタブ）", () => {
  it("タブをクリックするとcategoryクエリ付きでURLを置き換える", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("登録されている資料はありません");
    await user.click(screen.getByText("議事録"));

    expect(replace).toHaveBeenCalledWith("/tokyo-men-choir/library?category=minutes");
  });

  it("category指定時にdocumentsApi.listがcategory付きで呼ばれる", async () => {
    searchParams = new URLSearchParams("category=minutes");
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage();

    await screen.findByText("登録されている資料はありません");
    expect(documentsApi.list).toHaveBeenCalledWith("tokyo-men-choir", "minutes");
  });
});

describe("LibraryPage（資料追加ボタンの権限）", () => {
  it("adminロール: 「資料を追加」ボタンを表示する", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage(["admin"]);

    expect(await screen.findByText("資料を追加")).toBeInTheDocument();
  });

  it("member等: 「資料を追加」ボタンを表示しない", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage(["member"]);

    await screen.findByText("登録されている資料はありません");
    expect(screen.queryByText("資料を追加")).not.toBeInTheDocument();
  });

  it("「資料を追加」クリックでアップロードモーダルを開き、キャンセルで閉じる", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await user.click(await screen.findByText("資料を追加"));
    expect(screen.getByRole("heading", { name: "資料を追加" })).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));
    expect(screen.queryByRole("heading", { name: "資料を追加" })).not.toBeInTheDocument();
  });

  it("member等: 削除ボタンを表示しない", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([sampleDoc]);
    renderPage(["member"]);

    await screen.findByText("団則");
    expect(screen.queryByTitle("削除")).not.toBeInTheDocument();
  });
});

describe("LibraryPage（削除）", () => {
  it("削除確認モーダルで「削除する」を押すと削除され一覧から消える", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([sampleDoc]);
    vi.mocked(documentsApi.delete).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("団則");
    await user.click(screen.getByTitle("削除"));
    expect(screen.getByText("資料を削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByText("削除する"));

    expect(documentsApi.delete).toHaveBeenCalledWith("tokyo-men-choir", "doc-1");
    expect(await screen.findByText("登録されている資料はありません")).toBeInTheDocument();
  });

  it("削除に失敗したら確認ダイアログの中にエラーを表示し、資料は一覧に残る", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([sampleDoc]);
    vi.mocked(documentsApi.delete).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderPage(["admin"]);

    await screen.findByText("団則");
    await user.click(screen.getByRole("button", { name: "団則を削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    const dialog = screen.getByRole("alertdialog", { name: "資料を削除しますか？" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "削除に失敗しました。もう一度お試しください。",
    );
    expect(screen.getByText("団則")).toBeInTheDocument();
  });
});

const sampleScoreFile: CrossFileItem = {
  id: "stored-1",
  kind: "score",
  title: "男声合唱のための〇〇",
  subtitle: "楽譜PDF",
  fileName: "full.pdf",
  downloadUrl: "/api/v1/tokyo-men-choir/scores/score-1/files/sf-1/download",
  resourceLink: "/tokyo-men-choir/scores/score-1",
};

describe("LibraryPage（種別タブ）", () => {
  it("楽譜タブをクリックするとURLにtab=scoreが付与される", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("登録されている資料はありません");
    await user.click(screen.getByText("楽譜"));

    expect(replace).toHaveBeenCalledWith("/tokyo-men-choir/library?tab=score");
  });

  it("tab=scoreの場合、filesApi.listがkind=scoreで呼ばれ横断一覧を表示する", async () => {
    searchParams = new URLSearchParams("tab=score");
    vi.mocked(filesApi.list).mockResolvedValue([sampleScoreFile]);
    renderPage();

    expect(await screen.findByText("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("楽譜PDF")).toBeInTheDocument();
    expect(filesApi.list).toHaveBeenCalledWith("tokyo-men-choir", "score");
    // 資料タブ専用のカテゴリサブタブは表示されない
    expect(screen.queryByText("規約・規則")).not.toBeInTheDocument();
  });

  it("0件の場合は空表示を出す", async () => {
    searchParams = new URLSearchParams("tab=concert");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("登録されているファイルはありません")).toBeInTheDocument();
  });

  it("取得エラー時は理由を読み上げる形で表示する", async () => {
    searchParams = new URLSearchParams("tab=event");
    vi.mocked(filesApi.list).mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ファイルの読み込みに失敗しました。ページを再読み込みしてください。",
    );
  });
});

describe("LibraryPage（種別タブの追加ボタン権限）", () => {
  it("tech等の管理権限があるロール: 追加ボタンを表示する", async () => {
    searchParams = new URLSearchParams("tab=concert");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    renderPage(["tech"]);

    expect(await screen.findByText("本番ファイルを追加")).toBeInTheDocument();
  });

  it("member: 追加ボタンを表示しない", async () => {
    searchParams = new URLSearchParams("tab=concert");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    renderPage(["member"]);

    await screen.findByText("登録されているファイルはありません");
    expect(screen.queryByText("本番ファイルを追加")).not.toBeInTheDocument();
  });

  it("楽譜タブ: scoreロールで追加ボタンを表示する", async () => {
    searchParams = new URLSearchParams("tab=score");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    renderPage(["score"]);

    expect(await screen.findByText("楽譜ファイルを追加")).toBeInTheDocument();
  });
});

const sampleConcert: ConcertSummary = {
  id: "concert-1",
  title: "第20回定期演奏会",
  heldOn: "2026-11-23",
  venue: null,
  status: "draft",
  stageCount: 1,
  programCount: 1,
  hasSurvey: false,
  surveyOpen: false,
  linkedEventId: null,
};

const sampleScore: ScoreDetail = {
  id: "score-1",
  title: "楽譜A",
  composer: null,
  arranger: null,
  accessLevel: "restricted",
  distributionPrice: null,
  canAccessFiles: true,
  canDownload: true,
  files: [],
  isCommissioned: false,
  purchaseDate: null,
  distributionStart: null,
  notes: null,
  hasCollection: false,
};

describe("LibraryPage（選択からファイル管理へ）", () => {
  it("本番を選ぶとファイル管理が開き、閉じると一覧を取り直して「本番ファイルを追加」にフォーカスが戻る", async () => {
    searchParams = new URLSearchParams("tab=concert");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    vi.mocked(concertsApi.list).mockResolvedValue([sampleConcert]);
    vi.mocked(concertsApi.listFiles).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["admin", "member"]);

    await user.click(await screen.findByRole("button", { name: "本番ファイルを追加" }));
    await user.click(await screen.findByText("第20回定期演奏会"));
    expect(await screen.findByRole("dialog", { name: "第20回定期演奏会" })).toBeInTheDocument();
    const callsBeforeClose = vi.mocked(filesApi.list).mock.calls.length;
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(vi.mocked(filesApi.list).mock.calls.length).toBeGreaterThan(callsBeforeClose),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "本番ファイルを追加" })).toHaveFocus(),
    );
  });

  it("楽譜を選ぶと詳細を読み込んでから楽譜のファイル管理が開く。楽譜がかりはPDFを追加できる", async () => {
    searchParams = new URLSearchParams("tab=score");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: null, arranger: null },
    ]);
    vi.mocked(scoresApi.getDetail).mockResolvedValue(sampleScore);
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["member", "score"]);

    await user.click(await screen.findByRole("button", { name: "楽譜ファイルを追加" }));
    await user.click(await screen.findByText("楽譜A"));

    const dialog = await screen.findByRole("dialog", { name: "ファイル管理" });
    expect(within(dialog).getByRole("option", { name: "楽譜 (PDF)" })).toBeInTheDocument();
  });

  it("techには楽譜のPDFの追加を出さない（MIDIだけ）", async () => {
    searchParams = new URLSearchParams("tab=score");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    vi.mocked(scoresApi.list).mockResolvedValue([
      { id: "score-1", title: "楽譜A", composer: null, arranger: null },
    ]);
    vi.mocked(scoresApi.getDetail).mockResolvedValue(sampleScore);
    vi.mocked(membersApi.parts).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage(["member", "tech"]);

    await user.click(await screen.findByRole("button", { name: "楽譜ファイルを追加" }));
    await user.click(await screen.findByText("楽譜A"));

    const dialog = await screen.findByRole("dialog", { name: "ファイル管理" });
    expect(within(dialog).queryByRole("option", { name: "楽譜 (PDF)" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "MIDI" })).toBeInTheDocument();
  });

  it("主タブを切り替えると、開いていた選択のモーダルを閉じる", async () => {
    searchParams = new URLSearchParams("tab=concert");
    vi.mocked(filesApi.list).mockResolvedValue([]);
    vi.mocked(concertsApi.list).mockResolvedValue([sampleConcert]);
    const user = userEvent.setup();
    renderPage(["admin", "member"]);

    await user.click(await screen.findByRole("button", { name: "本番ファイルを追加" }));
    expect(await screen.findByRole("dialog", { name: "本番を選択" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "楽譜" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/tokyo-men-choir/library?tab=score");
  });

  it("主タブ・カテゴリタブの選択中が押された状態として読み上げられる", async () => {
    searchParams = new URLSearchParams("category=minutes");
    vi.mocked(documentsApi.list).mockResolvedValue([]);
    renderPage();

    expect(screen.getByRole("button", { name: "資料" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "楽譜" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "議事録" })).toHaveAttribute("aria-pressed", "true");
  });
});
