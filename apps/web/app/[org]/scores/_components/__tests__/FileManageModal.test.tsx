import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileManageModal } from "../FileManageModal";
import { scoresApi, type ScoreDetail, type ScoreFile } from "@/lib/scores-api";
import { type PartSummary } from "@/lib/members-api";

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return {
    ...actual,
    scoresApi: {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
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

function makeScore(files: ScoreFile[]): ScoreDetail {
  return {
    id: "score-1",
    title: "男声合唱のための〇〇",
    composer: null,
    arranger: null,
    accessLevel: "restricted",
    distributionPrice: null,
    canAccessFiles: true,
    canDownload: true,
    files,
    isCommissioned: false,
    purchaseDate: null,
    distributionStart: null,
    notes: null,
    hasCollection: false,
  };
}

const parts: PartSummary[] = [
  { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 0 },
  { id: "part-2", name: "ベース1", voiceType: "bass1", sortOrder: 1 },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("FileManageModal（表示）", () => {
  it("各セクションが0件の場合は「登録なし」を表示する", () => {
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByText("登録なし")).toHaveLength(3);
  });

  it("MIDIファイルはパート別にグループ表示する", () => {
    const files = [
      makeFile({ id: "m-global", fileType: "midi", fileName: "全体.mid" }),
      makeFile({
        id: "m-tenor",
        fileType: "midi",
        fileName: "テノール.mid",
        partId: "part-1",
        partName: "テノール1",
      }),
    ];
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore(files)}
        parts={parts}
        canManagePdf={false}
        canManageMidi={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("全体.mid")).toBeInTheDocument();
    expect(screen.getByText("テノール.mid")).toBeInTheDocument();
    expect(screen.getAllByText("テノール1").length).toBeGreaterThan(0);
  });

  it("part_score/audioタイプのファイルは「その他」セクションに表示される", () => {
    const files = [
      makeFile({ id: "p1", fileType: "part_score", fileName: "part.pdf" }),
      makeFile({ id: "a1", fileType: "audio", fileName: "audio.mp3" }),
    ];
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore(files)}
        parts={parts}
        canManagePdf={true}
        canManageMidi={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("part.pdf")).toBeInTheDocument();
    expect(screen.getByText("audio.mp3")).toBeInTheDocument();
  });

  it("canDelete=falseのファイルには削除ボタンを表示しない", () => {
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={false}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTitle("削除")).not.toBeInTheDocument();
  });
});

describe("FileManageModal（アップロード種別選択）", () => {
  it("canManagePdfかつ楽譜PDF未登録の場合は「楽譜 (PDF)」を選択肢に含める", () => {
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "楽譜 (PDF)" })).toBeInTheDocument();
  });

  it("楽譜PDFが登録済みの場合は「楽譜 (PDF)」を選択肢から除外する", () => {
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("option", { name: "楽譜 (PDF)" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "楽譜PDFは1つのみ登録できます。差し替える場合は既存ファイルを削除してから追加してください。",
      ),
    ).toBeInTheDocument();
  });

  it("canManageMidiの場合のみ「MIDI」を選択肢に含める", () => {
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([])}
        parts={parts}
        canManagePdf={false}
        canManageMidi={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "MIDI" })).toBeInTheDocument();
  });

  it("アップロード種別をMIDIにするとパート選択欄が表示される", async () => {
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([])}
        parts={parts}
        canManagePdf={false}
        canManageMidi={true}
        onClose={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByDisplayValue("MIDI"), "midi");
    expect(screen.getByRole("option", { name: "テノール1" })).toBeInTheDocument();
  });
});

describe("FileManageModal（アップロード）", () => {
  it("ファイル未選択で「追加」を押すとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByText("追加"));
    expect(await screen.findByRole("alert")).toHaveTextContent("ファイルを選択してください");
  });

  it("ファイル選択後「追加」を押すとアップロードしファイル一覧に反映する", async () => {
    vi.mocked(scoresApi.uploadFile).mockResolvedValue(
      makeFile({ id: "new-file", fileName: "new-score.pdf" }),
    );
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    const fileInput = screen
      .getByRole("dialog")
      .querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "new-score.pdf", { type: "application/pdf" });
    await user.upload(fileInput, file);
    await user.click(screen.getByText("追加"));

    expect(await screen.findByText("new-score.pdf")).toBeInTheDocument();
  });
});

describe("FileManageModal（削除）", () => {
  it("削除ボタンクリックで確認ダイアログを表示し、キャンセルで閉じる", async () => {
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("削除"));
    expect(screen.getByText("ファイルを削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));
    expect(screen.queryByText("ファイルを削除しますか？")).not.toBeInTheDocument();
  });

  it("削除を確定するとファイルが一覧から消える", async () => {
    vi.mocked(scoresApi.deleteFile).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("削除"));
    await user.click(screen.getByText("削除する"));

    expect(scoresApi.deleteFile).toHaveBeenCalledWith("o", "score-1", "file-1");
    await waitFor(() => expect(screen.queryByText("score.pdf")).not.toBeInTheDocument());
  });

  it("削除失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(scoresApi.deleteFile).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("削除"));
    await user.click(screen.getByText("削除する"));

    expect(await screen.findByRole("alert")).toHaveTextContent("削除に失敗しました");
  });
});

describe("FileManageModal（閉じる）", () => {
  it("閉じるボタン・Escapeキーで現在のファイル一覧を渡してonCloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledWith([makeFile()]);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("FileManageModal（モーダルの操作）", () => {
  function renderModal(onClose = vi.fn()) {
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={onClose}
      />,
    );
    return { onClose };
  }

  it("「ファイル管理」という名前のモーダルダイアログとして開く", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "ファイル管理" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });

  it("削除の確認はモーダルダイアログとして重ねて開き、Escでは確認だけが閉じる", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByTitle("削除"));
    expect(screen.getByRole("dialog", { name: "ファイルを削除しますか？" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "ファイルを削除しますか？" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "ファイル管理" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("削除中はEscで閉じない", async () => {
    vi.mocked(scoresApi.deleteFile).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByTitle("削除"));
    await user.click(screen.getByText("削除する"));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("閉じる")).toBeDisabled();
  });

  it("アップロード中はEscで閉じない", async () => {
    vi.mocked(scoresApi.uploadFile).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const fileInput = screen
      .getByRole("dialog")
      .querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["dummy"], "a.pdf", { type: "application/pdf" }));
    await user.click(screen.getByText("追加"));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("FileManageModal（削除ボタン）", () => {
  it("削除ボタンはファイル名を含む名前を持ち、ホバーしなくても表示する", () => {
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([makeFile()])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={false}
        onClose={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "score.pdfを削除" });
    expect(button.className).not.toMatch(/opacity-0/);
  });
});

describe("FileManageModal（ファイルを追加欄の名前）", () => {
  it("種類・パート・ファイル選択の各欄が名前を持つ", async () => {
    const user = userEvent.setup();
    render(
      <FileManageModal
        orgSlug="o"
        score={makeScore([])}
        parts={parts}
        canManagePdf={true}
        canManageMidi={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("追加するファイル")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "ファイルの種類" }), "midi");
    expect(screen.getByRole("combobox", { name: "パート" })).toBeInTheDocument();
  });
});
