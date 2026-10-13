import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StagesTab } from "../StagesTab";
import { type ConcertDetail } from "@/lib/concerts-api";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

beforeEach(() => {
  mockPointerCapture();
});

function makeConcert(overrides: Partial<ConcertDetail> = {}): ConcertDetail {
  return {
    id: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    venue: null,
    status: "draft",
    linkedEventId: null,
    stages: [
      {
        id: "stage-1",
        name: "第1ステージ",
        sortOrder: 0,
        programs: [
          {
            id: "program-1",
            title: "男声合唱のための〇〇",
            sortOrder: 0,
            score: { id: "score-1", composer: "△△", arranger: "□□" },
          },
        ],
      },
      { id: "stage-2", name: "第2ステージ", sortOrder: 1, programs: [] },
    ],
    surveys: [],
    appliedSurveyId: null,
    assignments: [],
    ...overrides,
  };
}

function defaultProps(overrides = {}) {
  return {
    isAdmin: true,
    onAddClick: vi.fn(),
    onAddStage: vi.fn(),
    onReorderStages: vi.fn(),
    onReorderPrograms: vi.fn(),
    onEditStageName: vi.fn().mockResolvedValue(undefined),
    onMoveCopyClick: vi.fn(),
    onEditProgramClick: vi.fn(),
    ...overrides,
  };
}

describe("StagesTab（表示）", () => {
  it("ステージ名・演目・作曲者/編曲者を表示する", () => {
    render(<StagesTab concert={makeConcert()} {...defaultProps()} />);

    expect(screen.getByText("第1ステージ")).toBeInTheDocument();
    expect(screen.getByText("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("△△ 作曲 / □□ 編曲")).toBeInTheDocument();
  });

  it("非adminかつステージ0件の場合は案内メッセージを表示する", () => {
    render(
      <StagesTab concert={makeConcert({ stages: [] })} {...defaultProps({ isAdmin: false })} />,
    );

    expect(screen.getByText("ステージ・演目が登録されていません")).toBeInTheDocument();
  });
});

describe("StagesTab（admin操作ボタン）", () => {
  it("adminロール: 編集・移動・追加系ボタンを表示する", () => {
    render(<StagesTab concert={makeConcert()} {...defaultProps()} />);

    expect(screen.getByRole("button", { name: "第1ステージの名前を編集" })).toBeInTheDocument();
    expect(screen.getAllByText("曲目を追加").length).toBeGreaterThan(0);
    expect(screen.getByText("ステージを追加")).toBeInTheDocument();
  });

  it("非adminロール: 編集・移動・追加系ボタンを表示しない", () => {
    render(<StagesTab concert={makeConcert()} {...defaultProps({ isAdmin: false })} />);

    expect(screen.queryByTitle("名前を編集")).not.toBeInTheDocument();
    expect(screen.queryByText("曲目を追加")).not.toBeInTheDocument();
    expect(screen.queryByText("ステージを追加")).not.toBeInTheDocument();
  });

  it("非adminロール: ステージ・曲目のドラッグハンドルを表示しない", () => {
    render(<StagesTab concert={makeConcert()} {...defaultProps({ isAdmin: false })} />);

    expect(screen.queryByLabelText("第1ステージをドラッグして並び替え")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("男声合唱のための〇〇をドラッグして並び替え"),
    ).not.toBeInTheDocument();
  });

  it("「曲目を追加」クリックでonAddClickが該当ステージIDで呼ばれる", async () => {
    const onAddClick = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onAddClick })} />);

    const stage1 = screen.getByText("第1ステージ").closest("section") as HTMLElement;
    await user.click(within(stage1).getByText("曲目を追加"));

    expect(onAddClick).toHaveBeenCalledWith("stage-1");
  });

  it("「ステージを追加」クリックでonAddStageが呼ばれる", async () => {
    const onAddStage = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onAddStage })} />);

    await user.click(screen.getByText("ステージを追加"));
    expect(onAddStage).toHaveBeenCalled();
  });
});

describe("StagesTab（演目の編集・移動・コピー）", () => {
  it("演目の「編集」クリックでonEditProgramClickが呼ばれる", async () => {
    const onEditProgramClick = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditProgramClick })} />);

    await user.click(screen.getByTitle("編集"));
    expect(onEditProgramClick).toHaveBeenCalledWith(
      "stage-1",
      expect.objectContaining({ id: "program-1" }),
    );
  });

  it("演目の「移動 / コピー」クリックでonMoveCopyClickが呼ばれる", async () => {
    const onMoveCopyClick = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onMoveCopyClick })} />);

    await user.click(screen.getByTitle("移動 / コピー"));
    expect(onMoveCopyClick).toHaveBeenCalledWith(
      "stage-1",
      expect.objectContaining({ id: "program-1" }),
    );
  });
});

describe("StagesTab（ステージ名インライン編集）", () => {
  const openEditor = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "第1ステージの名前を編集" }));
    return screen.getByRole("textbox", { name: "ステージ名" });
  };

  it("✏️クリックで入力欄に切り替わり、Enterで保存する", async () => {
    const onEditStageName = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const input = await openEditor(user);
    await user.clear(input);
    await user.type(input, "改称ステージ{Enter}");

    expect(onEditStageName).toHaveBeenCalledWith("stage-1", "改称ステージ");
    expect(screen.queryByRole("textbox", { name: "ステージ名" })).not.toBeInTheDocument();
  });

  it("保存に失敗したら入力欄の下に理由を出し、入力した名前を残す", async () => {
    const onEditStageName = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const input = await openEditor(user);
    await user.type(input, "改{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ステージ名の保存に失敗しました。もう一度お試しください。",
    );
    expect(screen.getByRole("textbox", { name: "ステージ名" })).toHaveValue("第1ステージ改");
  });

  it("保存中はEscapeキーで取り消せず、保存に成功したら編集欄を閉じる", async () => {
    let finish: () => void = () => {};
    const onEditStageName = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const input = await openEditor(user);
    await user.type(input, "改{Enter}");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("textbox", { name: "ステージ名" })).toBeInTheDocument();

    finish();
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "ステージ名" })).not.toBeInTheDocument(),
    );
  });

  it("Escapeキーで保存せずに閉じ、鉛筆にフォーカスを戻す", async () => {
    const onEditStageName = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const input = await openEditor(user);
    await user.type(input, "改{Escape}");

    expect(onEditStageName).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "第1ステージの名前を編集" })).toHaveFocus();
  });

  it("空にして保存すると理由を出し、保存しない", async () => {
    const onEditStageName = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const input = await openEditor(user);
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "ステージ名を保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent("ステージ名を入力してください");
    expect(onEditStageName).not.toHaveBeenCalled();
  });
});

// dnd-kitのドラッグ操作はjsdom上でpointer capture状態が後続テストのクリックに干渉するため、
// D&D関連のテストはファイル末尾にまとめる（FormationEditor.test.tsxと同じ方針）
describe("StagesTab（並び替え）", () => {
  it("ステージをドラッグで並び替えるとonReorderStagesが呼ばれる", () => {
    const onReorderStages = vi.fn();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onReorderStages })} />);

    dragAndDrop(
      screen.getByLabelText("第1ステージをドラッグして並び替え"),
      screen.getByLabelText("第2ステージをドラッグして並び替え"),
    );

    expect(onReorderStages).toHaveBeenCalledWith(["stage-2", "stage-1"]);
  });

  it("曲目をドラッグで並び替えるとonReorderProgramsが呼ばれる", () => {
    const onReorderPrograms = vi.fn();
    const concert = makeConcert({
      stages: [
        {
          id: "stage-1",
          name: "第1ステージ",
          sortOrder: 0,
          programs: [
            { id: "program-1", title: "1曲目", sortOrder: 0, score: null },
            { id: "program-2", title: "2曲目", sortOrder: 1, score: null },
          ],
        },
      ],
    });
    render(<StagesTab concert={concert} {...defaultProps({ onReorderPrograms })} />);

    dragAndDrop(
      screen.getByLabelText("2曲目をドラッグして並び替え"),
      screen.getByLabelText("1曲目をドラッグして並び替え"),
    );

    expect(onReorderPrograms).toHaveBeenCalledWith("stage-1", ["program-2", "program-1"]);
  });
});
