import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveCopyModal } from "../MoveCopyModal";
import { concertsApi, type ProgramDetail, type ConcertStructure } from "@/lib/concerts-api";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      getStructure: vi.fn(),
      addProgram: vi.fn(),
      deleteProgram: vi.fn(),
    },
  };
});

const program: ProgramDetail = {
  id: "program-1",
  title: "男声合唱のための〇〇",
  sortOrder: 0,
  score: { id: "score-1", composer: "△△", arranger: null },
};

const structure: ConcertStructure[] = [
  {
    id: "concert-1",
    title: "第20回定期演奏会",
    stages: [
      { id: "stage-1", name: "第1ステージ", sortOrder: 0 },
      { id: "stage-2", name: "第2ステージ", sortOrder: 1 },
    ],
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(concertsApi.getStructure).mockResolvedValue(structure);
});

function renderModal(overrides: Partial<Parameters<typeof MoveCopyModal>[0]> = {}) {
  return render(
    <MoveCopyModal
      orgSlug="o"
      concertId="concert-1"
      stageId="stage-1"
      program={program}
      onClose={vi.fn()}
      onComplete={vi.fn()}
      {...overrides}
    />,
  );
}

describe("MoveCopyModal（表示）", () => {
  it("読み込み中はローディング表示をする", () => {
    vi.mocked(concertsApi.getStructure).mockReturnValue(new Promise(() => {}));
    renderModal();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("現在のステージは選択肢内で無効化され「（現在のステージ）」と表示される", async () => {
    renderModal();

    const option = await screen.findByRole("option", { name: "第1ステージ（現在のステージ）" });
    expect(option).toBeDisabled();
  });
});

describe("MoveCopyModal（演奏会未定への移動）", () => {
  it("「演奏会未定」を選択して実行するとdeleteProgramのみ呼ばれonCompleteされる", async () => {
    vi.mocked(concertsApi.deleteProgram).mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const user = userEvent.setup();
    renderModal({ onComplete });

    await screen.findByText("読み込み中...", { exact: false }).catch(() => {});
    await user.click(screen.getByText("演奏会から削除"));

    expect(concertsApi.deleteProgram).toHaveBeenCalledWith("o", "concert-1", "program-1");
    expect(concertsApi.addProgram).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith("move", { type: "unassigned" });
  });
});

describe("MoveCopyModal（他ステージへの移動・コピー）", () => {
  it("移動: addProgramとdeleteProgramの両方が呼ばれonCompleteされる", async () => {
    vi.mocked(concertsApi.addProgram).mockResolvedValue({ ...program, id: "program-copied" });
    vi.mocked(concertsApi.deleteProgram).mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const user = userEvent.setup();
    renderModal({ onComplete });

    await user.selectOptions(
      await screen.findByLabelText("移動先 / コピー先"),
      "concert-1::stage-2",
    );
    await user.click(screen.getByText("移動する"));

    expect(concertsApi.addProgram).toHaveBeenCalledWith("o", "concert-1", "stage-2", {
      scoreId: "score-1",
      title: "男声合唱のための〇〇",
    });
    expect(concertsApi.deleteProgram).toHaveBeenCalledWith("o", "concert-1", "program-1");
    expect(onComplete).toHaveBeenCalledWith(
      "move",
      { type: "stage", concertId: "concert-1", stageId: "stage-2" },
      expect.objectContaining({ id: "program-copied" }),
    );
  });

  it("コピー: addProgramのみ呼ばれdeleteProgramは呼ばれない", async () => {
    vi.mocked(concertsApi.addProgram).mockResolvedValue({ ...program, id: "program-copied" });
    const onComplete = vi.fn();
    const user = userEvent.setup();
    renderModal({ onComplete });

    await user.selectOptions(
      await screen.findByLabelText("移動先 / コピー先"),
      "concert-1::stage-2",
    );
    await user.click(screen.getByLabelText("コピー"));
    await user.click(screen.getByText("コピーする"));

    expect(concertsApi.addProgram).toHaveBeenCalled();
    expect(concertsApi.deleteProgram).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(
      "copy",
      { type: "stage", concertId: "concert-1", stageId: "stage-2" },
      expect.objectContaining({ id: "program-copied" }),
    );
  });

  it("操作失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.addProgram).mockRejectedValue(new Error("操作に失敗しました"));
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(
      await screen.findByLabelText("移動先 / コピー先"),
      "concert-1::stage-2",
    );
    await user.click(screen.getByText("移動する"));

    expect(await screen.findByText("操作に失敗しました")).toBeInTheDocument();
  });
});

describe("MoveCopyModal（閉じる）", () => {
  it("閉じるボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
