import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScoreDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { scoresApi, type ScoreDetail, type ScoreFile } from "@/lib/scores-api";
import { membersApi } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", scoreId: "score-1" }),
}));

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return {
    ...actual,
    scoresApi: {
      getDetail: vi.fn(),
      setPrice: vi.fn(),
      getPurchases: vi.fn().mockResolvedValue([]),
      putPurchases: vi.fn(),
    },
  };
});

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return {
    ...actual,
    membersApi: {
      ...actual.membersApi,
      parts: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      ...actual.settingsApi,
      listMemberTypes: vi.fn().mockResolvedValue([]),
    },
  };
});

function makeFile(overrides: Partial<ScoreFile> = {}): ScoreFile {
  return {
    id: "file-1",
    fileType: "full_score",
    fileName: "score.pdf",
    partId: null,
    partName: null,
    version: 1,
    ...overrides,
  };
}

function makeScore(overrides: Partial<ScoreDetail> = {}): ScoreDetail {
  return {
    id: "score-1",
    title: "男声合唱のための〇〇",
    composer: "△△",
    arranger: "□□",
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
    ...overrides,
  };
}

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <ScoreDetailPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([]);
  vi.mocked(membersApi.list).mockResolvedValue([]);
  vi.mocked(settingsApi.listMemberTypes).mockResolvedValue([]);
});

describe("ScoreDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(scoresApi.getDetail).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("曲名・作曲者・編曲者を表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore());
    renderPage();

    expect(await screen.findByText("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("△△ 作曲 / □□ 編曲")).toBeInTheDocument();
  });
});

describe("ScoreDetailPage（ファイルセクション）", () => {
  it("canAccessFiles: false かつ accessLevel: secret の場合は閲覧制限メッセージを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ canAccessFiles: false, accessLevel: "secret" }),
    );
    renderPage();

    expect(await screen.findByText("閲覧制限されています")).toBeInTheDocument();
  });

  it("canAccessFiles: false かつ accessLevel: restricted の場合は購入案内メッセージを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ canAccessFiles: false, accessLevel: "restricted" }),
    );
    renderPage();

    expect(await screen.findByText("楽譜を購入すると閲覧できます")).toBeInTheDocument();
  });

  it("楽譜PDFが登録されている場合はリンクを、未登録の場合は「楽譜未登録」を表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ canAccessFiles: true, files: [makeFile()] }),
    );
    renderPage();

    expect(await screen.findByText("楽譜PDF")).toBeInTheDocument();

    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ canAccessFiles: true, files: [] }),
    );
    renderPage();
    expect(await screen.findByText("楽譜未登録")).toBeInTheDocument();
  });

  it("canDownload: true かつMIDI登録ありの場合は件数付きボタンを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({
        canDownload: true,
        files: [makeFile({ id: "m1", fileType: "midi" }), makeFile({ id: "m2", fileType: "midi" })],
      }),
    );
    renderPage();

    expect(await screen.findByText("2件")).toBeInTheDocument();
  });

  it("canDownload: false の場合はMIDIボタン・未登録表示のどちらも出さない", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ canDownload: false }));
    renderPage();

    await screen.findByText("男声合唱のための〇〇");
    expect(screen.queryByText(/MIDI/)).not.toBeInTheDocument();
  });
});

describe("ScoreDetailPage（詳細情報セクション）", () => {
  it("表示するメタデータが無い場合は「詳細情報はありません」を表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore());
    renderPage(["guest"]);

    expect(await screen.findByText("詳細情報はありません")).toBeInTheDocument();
  });

  it("委嘱・購入日・配布開始日・備考を表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({
        isCommissioned: true,
        purchaseDate: "2026-10-01",
        distributionStart: "2026-10-15",
        notes: "初版",
      }),
    );
    renderPage(["guest"]);

    expect(await screen.findByText("委嘱作品")).toBeInTheDocument();
    expect(screen.getByText("2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("2026-10-15")).toBeInTheDocument();
    expect(screen.getByText("初版")).toBeInTheDocument();
  });

  it("member+の場合は配布価格行を表示し、guest/visitorの場合は表示しない", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: 500 }));
    const { unmount } = renderPage(["member"]);
    expect(await screen.findByText("配布価格")).toBeInTheDocument();
    unmount();

    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: 500 }));
    renderPage(["guest"]);
    await screen.findByText("男声合唱のための〇〇");
    expect(screen.queryByText("配布価格")).not.toBeInTheDocument();
  });

  it("価格未設定・非privilegedの場合は「未設定」を表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: null }));
    renderPage(["member"]);

    expect(await screen.findByText("未設定")).toBeInTheDocument();
  });

  it("価格未設定・privileged（admin/score）の場合は「+ 価格を設定」ボタンを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: null }));
    renderPage(["score"]);

    expect(await screen.findByText("+ 価格を設定")).toBeInTheDocument();
  });

  it("score+のみ仕入価格・購入者数を表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ purchasePrice: 1200, purchaseCount: 20 }),
    );
    const { unmount } = renderPage(["score"]);

    expect(await screen.findByText("仕入価格")).toBeInTheDocument();
    expect(screen.getByText("¥1,200")).toBeInTheDocument();
    expect(screen.getByText("20名")).toBeInTheDocument();
    unmount();

    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ purchasePrice: 1200, purchaseCount: 20, distributionPrice: 500 }),
    );
    renderPage(["member"]);
    await screen.findByText("配布価格");
    expect(screen.queryByText("仕入価格")).not.toBeInTheDocument();
  });
});

describe("ScoreDetailPage（配布価格インライン編集）", () => {
  it("✏️クリックで入力欄に切り替わり、Enterで保存する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: 500 }));
    vi.mocked(scoresApi.setPrice).mockResolvedValue({ id: "score-1", distributionPrice: 800 });
    const user = userEvent.setup();
    renderPage(["score"]);

    await user.click(await screen.findByTitle("価格を変更"));
    const input = screen.getByPlaceholderText("例: 300");
    await user.clear(input);
    await user.type(input, "800{Enter}");

    expect(scoresApi.setPrice).toHaveBeenCalledWith("tokyo-men-choir", "score-1", 800);
    expect(await screen.findByText("¥800")).toBeInTheDocument();
  });

  it("Escapeキーで編集をキャンセルする", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: 500 }));
    const user = userEvent.setup();
    renderPage(["score"]);

    await user.click(await screen.findByTitle("価格を変更"));
    const input = screen.getByPlaceholderText("例: 300");
    await user.type(input, "999{Escape}");

    expect(scoresApi.setPrice).not.toHaveBeenCalled();
    expect(await screen.findByText("¥500")).toBeInTheDocument();
  });

  it("member（非privileged）は価格編集ボタンを表示しない", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: 500 }));
    renderPage(["member"]);

    await screen.findByText("¥500");
    expect(screen.queryByTitle("価格を変更")).not.toBeInTheDocument();
  });
});

describe("ScoreDetailPage（管理セクション）", () => {
  it("isFileManager（score/tech/conductor/admin）の場合は管理セクションを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore());
    renderPage(["tech"]);

    expect(await screen.findByText("管理")).toBeInTheDocument();
    expect(screen.getByText("ファイル管理")).toBeInTheDocument();
  });

  it("member/guestの場合は管理セクションを表示しない", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore());
    renderPage(["member"]);

    await screen.findByText("男声合唱のための〇〇");
    expect(screen.queryByText("管理")).not.toBeInTheDocument();
  });

  it("score+かつ配布価格が未設定の場合は徴収ボタンを表示しない", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ distributionPrice: null, hasCollection: false }),
    );
    renderPage(["score"]);

    await screen.findByText("管理");
    expect(screen.queryByText("+ 徴収を作成")).not.toBeInTheDocument();
  });

  it("score+かつ配布価格設定済みの場合は「+ 徴収を作成」ボタンを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ distributionPrice: 500, hasCollection: false }),
    );
    renderPage(["score"]);

    expect(await screen.findByText("+ 徴収を作成")).toBeInTheDocument();
  });

  it("hasCollection: true の場合は「徴収作成済み」バッジを表示する", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ distributionPrice: 500, hasCollection: true }),
    );
    renderPage(["score"]);

    expect(await screen.findByText("徴収作成済み")).toBeInTheDocument();
  });

  it("techロールは徴収ボタン・バッジのどちらも表示しない（score+専用）", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ distributionPrice: 500, hasCollection: false }),
    );
    renderPage(["tech"]);

    await screen.findByText("管理");
    expect(screen.queryByText("+ 徴収を作成")).not.toBeInTheDocument();
    expect(screen.queryByText("徴収作成済み")).not.toBeInTheDocument();
  });
});

describe("ScoreDetailPage（モーダル起動）", () => {
  it("編集ボタン（score+）クリックで編集モーダルを開く", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore());
    const user = userEvent.setup();
    renderPage(["score"]);

    await user.click(await screen.findByText("編集"));
    expect(screen.getByText("楽譜情報を編集")).toBeInTheDocument();
  });

  it("member（非privileged）は編集ボタンを表示しない", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore());
    renderPage(["member"]);

    await screen.findByText("男声合唱のための〇〇");
    expect(screen.queryByText("編集")).not.toBeInTheDocument();
  });

  it("MIDIボタンクリックでMIDIモーダルを開く", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ canDownload: true, files: [makeFile({ fileType: "midi" })] }),
    );
    const user = userEvent.setup();
    renderPage(["member"]);

    await user.click(await screen.findByText(/MIDI/));
    expect(
      screen.getByRole("heading", { name: "男声合唱のための〇〇", level: 2 }),
    ).toBeInTheDocument();
  });

  it("「管理」クリックで購入者管理モーダルを開く", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(
      makeScore({ purchaseCount: 3, purchasePrice: 1000 }),
    );
    const user = userEvent.setup();
    renderPage(["score"]);

    await user.click(await screen.findByText("管理", { selector: "button" }));
    expect(await screen.findByText("購入者を記録")).toBeInTheDocument();
  });

  it("「ファイル管理」クリックでファイル管理モーダルを開く", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore());
    const user = userEvent.setup();
    renderPage(["score"]);

    await user.click(await screen.findByText("ファイル管理"));
    expect(screen.getByText("ファイルを追加")).toBeInTheDocument();
  });

  it("「+ 徴収を作成」クリックで徴収作成モーダルを開く", async () => {
    vi.mocked(scoresApi.getDetail).mockResolvedValue(makeScore({ distributionPrice: 500 }));
    const user = userEvent.setup();
    renderPage(["score"]);

    await user.click(await screen.findByText("+ 徴収を作成"));
    expect(await screen.findByRole("heading", { name: "徴収を作成" })).toBeInTheDocument();
  });
});
