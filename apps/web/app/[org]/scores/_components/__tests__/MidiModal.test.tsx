import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MidiModal } from "../MidiModal";
import { type ScoreDetail, type ScoreFile } from "@/lib/scores-api";

function makeFile(overrides: Partial<ScoreFile> = {}): ScoreFile {
  return {
    id: "file-1",
    fileType: "midi",
    fileName: "midi.mp3",
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
    composer: "△△",
    arranger: "□□",
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

describe("MidiModal（表示）", () => {
  it("MIDIファイルが0件の場合は案内メッセージを表示する", () => {
    render(<MidiModal score={makeScore([])} onClose={vi.fn()} />);

    expect(screen.getByText("MIDIファイルが登録されていません")).toBeInTheDocument();
  });

  it("曲名・作曲者/編曲者を表示する", () => {
    render(<MidiModal score={makeScore([])} onClose={vi.fn()} />);

    expect(screen.getByText("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("△△ 作曲 / □□ 編曲")).toBeInTheDocument();
  });

  it("パート未指定のMIDIは「全体」として表示する", () => {
    render(
      <MidiModal
        score={makeScore([makeFile({ id: "g1", fileName: "全体.mp3", partId: null })])}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("全体")).toBeInTheDocument();
    expect(screen.getByText("全体.mp3")).toBeInTheDocument();
  });

  it("パート別に50音順でグループ表示する", () => {
    const files = [
      makeFile({ id: "b1", fileName: "bass.mp3", partId: "part-b", partName: "バス" }),
      makeFile({ id: "a1", fileName: "alto.mp3", partId: "part-a", partName: "アルト" }),
    ];
    render(<MidiModal score={makeScore(files)} onClose={vi.fn()} />);

    const headings = screen.getAllByText(/^(アルト|バス)$/).map((el) => el.textContent);
    expect(headings).toEqual(["アルト", "バス"]);
  });

  it("同一パートに複数ファイルある場合は件数ラベルを表示する", () => {
    const files = [
      makeFile({ id: "t1", fileName: "tenor1.mp3", partId: "part-t", partName: "テノール" }),
      makeFile({ id: "t2", fileName: "tenor2.mp3", partId: "part-t", partName: "テノール" }),
    ];
    render(<MidiModal score={makeScore(files)} onClose={vi.fn()} />);

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });
});

describe("MidiModal（再生・ダウンロード）", () => {
  it("再生ボタンクリックでaudio要素を表示し、再度クリックで閉じる", async () => {
    const user = userEvent.setup();
    const { container } = render(<MidiModal score={makeScore([makeFile()])} onClose={vi.fn()} />);

    expect(container.querySelector("audio")).not.toBeInTheDocument();
    await user.click(screen.getByTitle("再生"));
    expect(container.querySelector("audio")).toBeInTheDocument();

    await user.click(screen.getByTitle("閉じる"));
    expect(container.querySelector("audio")).not.toBeInTheDocument();
  });

  it("downloadUrlがある場合はそのURLを、無い場合はデモ音源URLをダウンロードリンクに使う", () => {
    render(
      <MidiModal
        score={makeScore([
          makeFile({
            id: "f1",
            fileName: "with-url.mp3",
            downloadUrl: "https://example.com/a.mp3",
          }),
        ])}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTitle("ダウンロード")).toHaveAttribute("href", "https://example.com/a.mp3");
  });

  it("downloadUrl未設定時はデモ音源URLにフォールバックする", () => {
    render(
      <MidiModal score={makeScore([makeFile({ downloadUrl: undefined })])} onClose={vi.fn()} />,
    );

    expect(screen.getByTitle("ダウンロード")).toHaveAttribute("href", "/demo/test_midi.mp3");
  });
});

describe("MidiModal（閉じる）", () => {
  it("閉じるボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MidiModal score={makeScore([])} onClose={onClose} />);

    const closeButtons = screen.getAllByRole("button");
    await user.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
