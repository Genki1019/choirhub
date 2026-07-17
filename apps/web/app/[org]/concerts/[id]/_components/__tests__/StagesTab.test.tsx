import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StagesTab } from "../StagesTab";
import { type ConcertDetail } from "@/lib/concerts-api";

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
    onMoveStage: vi.fn(),
    onMoveProgram: vi.fn(),
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

    expect(screen.getAllByTitle("名前を編集").length).toBeGreaterThan(0);
    expect(screen.getAllByText("曲目を追加").length).toBeGreaterThan(0);
    expect(screen.getByText("ステージを追加")).toBeInTheDocument();
  });

  it("非adminロール: 編集・移動・追加系ボタンを表示しない", () => {
    render(<StagesTab concert={makeConcert()} {...defaultProps({ isAdmin: false })} />);

    expect(screen.queryByTitle("名前を編集")).not.toBeInTheDocument();
    expect(screen.queryByText("曲目を追加")).not.toBeInTheDocument();
    expect(screen.queryByText("ステージを追加")).not.toBeInTheDocument();
  });

  it("先頭ステージの「上へ」・末尾ステージの「下へ」は無効化される", () => {
    render(<StagesTab concert={makeConcert()} {...defaultProps()} />);

    const stage1Header = screen.getByText("第1ステージ").closest("div") as HTMLElement;
    const stage2Header = screen.getByText("第2ステージ").closest("div") as HTMLElement;
    expect(within(stage1Header).getByTitle("上へ")).toBeDisabled();
    expect(within(stage2Header).getByTitle("下へ")).toBeDisabled();
    expect(within(stage1Header).getByTitle("下へ")).not.toBeDisabled();
  });

  it("ステージの「下へ」クリックでonMoveStageが呼ばれる", async () => {
    const onMoveStage = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onMoveStage })} />);

    const stage1Header = screen.getByText("第1ステージ").closest("div") as HTMLElement;
    await user.click(within(stage1Header).getByTitle("下へ"));

    expect(onMoveStage).toHaveBeenCalledWith("stage-1", 1);
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
  it("✏️クリックで入力欄に切り替わり、Enterで保存する", async () => {
    const onEditStageName = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const stage1Header = screen.getByText("第1ステージ").closest("div") as HTMLElement;
    await user.click(within(stage1Header).getByTitle("名前を編集"));
    const input = screen.getByDisplayValue("第1ステージ");
    await user.clear(input);
    await user.type(input, "改称ステージ{Enter}");

    expect(onEditStageName).toHaveBeenCalledWith("stage-1", "改称ステージ");
  });

  it("Escapeキーで編集をキャンセルする", async () => {
    const onEditStageName = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const stage1Header = screen.getByText("第1ステージ").closest("div") as HTMLElement;
    await user.click(within(stage1Header).getByTitle("名前を編集"));
    await user.type(screen.getByDisplayValue("第1ステージ"), "変更中{Escape}");

    expect(onEditStageName).not.toHaveBeenCalled();
    expect(screen.getByText("第1ステージ")).toBeInTheDocument();
  });

  it("空文字で保存しようとするとキャンセル扱いになる", async () => {
    const onEditStageName = vi.fn();
    const user = userEvent.setup();
    render(<StagesTab concert={makeConcert()} {...defaultProps({ onEditStageName })} />);

    const stage1Header = screen.getByText("第1ステージ").closest("div") as HTMLElement;
    await user.click(within(stage1Header).getByTitle("名前を編集"));
    const input = screen.getByDisplayValue("第1ステージ");
    await user.clear(input);
    await user.click(screen.getByLabelText("保存"));

    expect(onEditStageName).not.toHaveBeenCalled();
  });
});
