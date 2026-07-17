import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnstageTab } from "../OnstageTab";
import {
  concertsApi,
  type AssignmentDetail,
  type ConcertDetail,
  type FormationPatternDetail,
} from "@/lib/concerts-api";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      createFormationPattern: vi.fn(),
      updateFormationPattern: vi.fn(),
      deleteFormationPattern: vi.fn(),
      reorderFormationPatterns: vi.fn(),
      saveFormationSlots: vi.fn(),
    },
  };
});

function makePattern(overrides: Partial<FormationPatternDetail> = {}): FormationPatternDetail {
  return {
    id: "pattern-1",
    name: "パターン1",
    sortOrder: 0,
    isStaggered: false,
    pianoPosition: "center",
    boxes: [
      { id: "box-c", kind: "conductor", title: null, sortOrder: 0 },
      { id: "box-p", kind: "piano", title: null, sortOrder: 1 },
    ],
    slots: [],
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<AssignmentDetail> = {}): AssignmentDetail {
  return {
    memberId: "m1",
    nameJa: "山田太郎",
    partId: "p1",
    partName: "テノール1",
    partSortOrder: 1,
    partVoiceType: "tenor1",
    stageId: "stage-1",
    status: "on",
    ...overrides,
  };
}

function makeConcert(overrides: Partial<ConcertDetail> = {}): ConcertDetail {
  return {
    id: "concert-1",
    title: "第20回定期演奏会",
    heldOn: "2026-11-23",
    venue: null,
    status: "confirmed",
    linkedEventId: null,
    stages: [
      {
        id: "stage-1",
        name: "第1ステージ",
        sortOrder: 0,
        programs: [],
        formationPatterns: [makePattern()],
      },
    ],
    surveys: [],
    appliedSurveyId: null,
    assignments: [makeAssignment()],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OnstageTab（空状態）", () => {
  it("オンステ確定前（assignments 0件）は案内メッセージを表示する", () => {
    render(
      <OnstageTab
        concert={makeConcert({ assignments: [] })}
        org="o"
        canManageStage={true}
        onStagesChanged={vi.fn()}
      />,
    );
    expect(
      screen.getByText("オンステ確定後に、出演メンバーとフォーメーションがここに表示されます"),
    ).toBeInTheDocument();
  });

  it("ステージが0件の場合はメッセージを表示する", () => {
    render(
      <OnstageTab
        concert={makeConcert({ stages: [] })}
        org="o"
        canManageStage={true}
        onStagesChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("ステージが登録されていません")).toBeInTheDocument();
  });
});

describe("OnstageTab（ステージ切替）", () => {
  it("ステージが複数ある場合は切替チップを表示し、クリックで切り替わる", async () => {
    const concert = makeConcert({
      stages: [
        {
          id: "stage-1",
          name: "第1ステージ",
          sortOrder: 0,
          programs: [],
          formationPatterns: [makePattern({ id: "p1", name: "パターンA" })],
        },
        {
          id: "stage-2",
          name: "第2ステージ",
          sortOrder: 1,
          programs: [],
          formationPatterns: [makePattern({ id: "p2", name: "パターンB" })],
        },
      ],
    });
    const user = userEvent.setup();
    render(
      <OnstageTab concert={concert} org="o" canManageStage={true} onStagesChanged={vi.fn()} />,
    );

    expect(screen.getByText("パターンA")).toBeInTheDocument();
    await user.click(screen.getByText("第2ステージ"));
    expect(screen.getByText("パターンB")).toBeInTheDocument();
  });

  it("ステージが1件のみの場合は切替チップを表示しない", () => {
    render(
      <OnstageTab
        concert={makeConcert()}
        org="o"
        canManageStage={true}
        onStagesChanged={vi.fn()}
      />,
    );
    expect(screen.queryByText("第1ステージ")).not.toBeInTheDocument();
  });
});

describe("OnstageTab（フォーメーションパターンが無い場合）", () => {
  it("canManageStage: trueの場合は作成を促すメッセージを表示する", () => {
    const concert = makeConcert({
      stages: [
        { id: "stage-1", name: "第1ステージ", sortOrder: 0, programs: [], formationPatterns: [] },
      ],
    });
    render(
      <OnstageTab concert={concert} org="o" canManageStage={true} onStagesChanged={vi.fn()} />,
    );
    expect(
      screen.getByText("「新しいパターン」からフォーメーションを作成してください"),
    ).toBeInTheDocument();
  });

  it("canManageStage: falseの場合は未作成メッセージを表示する", () => {
    const concert = makeConcert({
      stages: [
        { id: "stage-1", name: "第1ステージ", sortOrder: 0, programs: [], formationPatterns: [] },
      ],
    });
    render(
      <OnstageTab concert={concert} org="o" canManageStage={false} onStagesChanged={vi.fn()} />,
    );
    expect(
      screen.getByText("フォーメーションパターンがまだ作成されていません"),
    ).toBeInTheDocument();
  });
});

describe("OnstageTab（パターンCRUD）", () => {
  it("「新しいパターン」クリックでcreateFormationPatternが呼ばれ新パターンが選択される", async () => {
    const concert = makeConcert({
      stages: [
        { id: "stage-1", name: "第1ステージ", sortOrder: 0, programs: [], formationPatterns: [] },
      ],
    });
    vi.mocked(concertsApi.createFormationPattern).mockResolvedValue(
      makePattern({ id: "pattern-new", name: "パターン1" }),
    );
    const onStagesChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <OnstageTab
        concert={concert}
        org="o"
        canManageStage={true}
        onStagesChanged={onStagesChanged}
      />,
    );

    await user.click(screen.getByText("新しいパターン"));

    expect(concertsApi.createFormationPattern).toHaveBeenCalledWith(
      "o",
      "concert-1",
      "stage-1",
      "パターン1",
    );
    expect(onStagesChanged).toHaveBeenCalled();
  });

  it("✏️クリックで名称編集入力に切り替わりEnterで保存する", async () => {
    vi.mocked(concertsApi.updateFormationPattern).mockResolvedValue({
      id: "pattern-1",
      name: "改称パターン",
      sortOrder: 0,
      isStaggered: false,
      pianoPosition: "center",
    });
    const user = userEvent.setup();
    render(
      <OnstageTab
        concert={makeConcert()}
        org="o"
        canManageStage={true}
        onStagesChanged={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("名称変更"));
    const input = screen.getByDisplayValue("パターン1");
    await user.clear(input);
    await user.type(input, "改称パターン{Enter}");

    expect(concertsApi.updateFormationPattern).toHaveBeenCalledWith(
      "o",
      "concert-1",
      "stage-1",
      "pattern-1",
      {
        name: "改称パターン",
      },
    );
  });

  it("削除クリックでdeleteFormationPatternが呼ばれる", async () => {
    vi.mocked(concertsApi.deleteFormationPattern).mockResolvedValue(undefined);
    const onStagesChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <OnstageTab
        concert={makeConcert()}
        org="o"
        canManageStage={true}
        onStagesChanged={onStagesChanged}
      />,
    );

    await user.click(screen.getByTitle("削除"));

    expect(concertsApi.deleteFormationPattern).toHaveBeenCalledWith(
      "o",
      "concert-1",
      "stage-1",
      "pattern-1",
    );
  });

  it("パターンが1件のみの場合、前へ/後へボタンは非活性になる", () => {
    render(
      <OnstageTab
        concert={makeConcert()}
        org="o"
        canManageStage={true}
        onStagesChanged={vi.fn()}
      />,
    );
    expect(screen.getByTitle("前へ")).toBeDisabled();
    expect(screen.getByTitle("後へ")).toBeDisabled();
  });
});

describe("OnstageTab（プレビュー切替）", () => {
  it("canManageStageの場合はプレビュートグルボタンを表示し、クリックで表示が切り替わる", async () => {
    const user = userEvent.setup();
    render(
      <OnstageTab
        concert={makeConcert()}
        org="o"
        canManageStage={true}
        onStagesChanged={vi.fn()}
      />,
    );

    expect(screen.getByText("メンバーを配置")).toBeInTheDocument();
    await user.click(screen.getByText("プレビュー"));
    expect(screen.queryByText("メンバーを配置")).not.toBeInTheDocument();
  });

  it("canManageStage: falseの場合は常にプレビュー表示でトグルボタンも無い", () => {
    render(
      <OnstageTab
        concert={makeConcert()}
        org="o"
        canManageStage={false}
        onStagesChanged={vi.fn()}
      />,
    );
    expect(screen.queryByText("プレビュー")).not.toBeInTheDocument();
    expect(screen.queryByText("メンバーを配置")).not.toBeInTheDocument();
  });
});

describe("OnstageTab（オフステ・回答なしセクション）", () => {
  it("off/undecidedステータスのメンバーをそれぞれ表示する", () => {
    const concert = makeConcert({
      assignments: [
        makeAssignment({ memberId: "m1", status: "on" }),
        makeAssignment({ memberId: "m2", nameJa: "鈴木花子", status: "off" }),
        makeAssignment({ memberId: "m3", nameJa: "田中次郎", status: "undecided" }),
      ],
    });
    render(
      <OnstageTab concert={concert} org="o" canManageStage={true} onStagesChanged={vi.fn()} />,
    );

    expect(screen.getByText("オフステ")).toBeInTheDocument();
    expect(screen.getByTitle("鈴木花子")).toBeInTheDocument();
    expect(screen.getByText("回答なし")).toBeInTheDocument();
    expect(screen.getByTitle("田中次郎")).toBeInTheDocument();
  });
});
