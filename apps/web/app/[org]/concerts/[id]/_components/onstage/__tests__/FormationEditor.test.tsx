import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormationEditor } from "../FormationEditor";
import {
  concertsApi,
  type AssignmentDetail,
  type FormationPatternDetail,
} from "@/lib/concerts-api";
import { buildPartColorMap } from "../formation-model";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
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

const stageAssignments: AssignmentDetail[] = [
  {
    memberId: "m1",
    nameJa: "山田太郎",
    partId: "p1",
    partName: "テノール1",
    partSortOrder: 1,
    partVoiceType: "tenor1",
    stageId: "stage-1",
    status: "on",
  },
  {
    memberId: "m2",
    nameJa: "鈴木花子",
    partId: "p2",
    partName: "ベース",
    partSortOrder: 2,
    partVoiceType: "bass1",
    stageId: "stage-1",
    status: "on",
  },
];

function defaultProps(overrides: Partial<Parameters<typeof FormationEditor>[0]> = {}) {
  return {
    org: "o",
    concertId: "concert-1",
    stageId: "stage-1",
    pattern: makePattern(),
    stageAssignments,
    partColorMap: buildPartColorMap(stageAssignments),
    onFormationChanged: vi.fn(),
    onIsStaggeredChanged: vi.fn(),
    onPianoPositionChanged: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(concertsApi.saveFormationSlots).mockResolvedValue(undefined);
  mockPointerCapture();
});

describe("FormationEditor（表示）", () => {
  it("指揮・ピアノ枠と未配置プールのメンバーを表示する", () => {
    render(<FormationEditor {...defaultProps()} />);

    expect(screen.getByText("指揮")).toBeInTheDocument();
    expect(screen.getByText("ピアノ")).toBeInTheDocument();
    expect(screen.getByTitle("山田太郎")).toBeInTheDocument();
    expect(screen.getByTitle("鈴木花子")).toBeInTheDocument();
  });
});

describe("FormationEditor（メンバー・客演の配置）", () => {
  it("「メンバーを配置」から団員を検索して配置するとsaveFormationSlotsが呼ばれプールから消える", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps()} />);

    await user.click(screen.getByText("メンバーを配置"));
    await user.type(screen.getByPlaceholderText("団員名で検索"), "山田");
    await user.click(screen.getByRole("button", { name: /山田太郎/ }));

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.queryByTitle("山田太郎")).not.toBeInTheDocument();
  });

  it("客演モードで名前を入力して追加すると客演チップが表示される", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps()} />);

    await user.click(screen.getByText("メンバーを配置"));
    await user.click(screen.getByText("客演"));
    await user.type(screen.getByPlaceholderText("客演者の名前"), "客演太郎");
    await user.click(screen.getByText("追加"));

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.getByTitle("客演太郎")).toBeInTheDocument();
  });
});

describe("FormationEditor（枠の追加・編集・削除）", () => {
  it("「枠を追加」から新しい枠を作成できる", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps()} />);

    await user.click(screen.getByText("枠を追加"));
    await user.type(screen.getByPlaceholderText("枠の名前"), "ソロ");
    await user.click(screen.getByText("作成"));

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.getByText("ソロ")).toBeInTheDocument();
  });

  const soloPattern = () =>
    makePattern({
      boxes: [
        { id: "box-c", kind: "conductor", title: null, sortOrder: 0 },
        { id: "box-p", kind: "piano", title: null, sortOrder: 1 },
        { id: "box-solo", kind: "custom", title: "ソロ", sortOrder: 2 },
      ],
    });

  it("カスタム枠の鉛筆で枠名を編集し、Enter で保存して鉛筆にフォーカスを戻す", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern: soloPattern() })} />);

    await user.click(screen.getByRole("button", { name: "ソロの枠名を編集" }));
    const input = screen.getByRole("textbox", { name: "枠名" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "独唱{Enter}");

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.getByText("独唱")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "枠名" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "独唱の枠名を編集" })).toHaveFocus();
  });

  it("枠名が空なら保存せず理由を出し、Esc で取り消せる", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern: soloPattern() })} />);

    await user.click(screen.getByRole("button", { name: "ソロの枠名を編集" }));
    await user.clear(screen.getByRole("textbox", { name: "枠名" }));
    await user.click(screen.getByRole("button", { name: "枠名を保存" }));
    expect(screen.getByRole("alert")).toHaveTextContent("枠名を入力してください");

    await user.click(screen.getByRole("textbox", { name: "枠名" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "枠名" })).not.toBeInTheDocument();
    expect(screen.getByText("ソロ")).toBeInTheDocument();
    expect(concertsApi.saveFormationSlots).not.toHaveBeenCalled();
  });

  it("枠名を変えずに保存すると、保存せずに閉じる", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern: soloPattern() })} />);

    await user.click(screen.getByRole("button", { name: "ソロの枠名を編集" }));
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("textbox", { name: "枠名" })).not.toBeInTheDocument();
    expect(concertsApi.saveFormationSlots).not.toHaveBeenCalled();
  });

  it("カスタム枠の✕クリックで枠を削除できる", async () => {
    const pattern = makePattern({
      boxes: [
        { id: "box-c", kind: "conductor", title: null, sortOrder: 0 },
        { id: "box-p", kind: "piano", title: null, sortOrder: 1 },
        { id: "box-solo", kind: "custom", title: "ソロ", sortOrder: 2 },
      ],
    });
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern })} />);

    await user.click(screen.getByTitle("枠を削除"));

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.queryByText("ソロ")).not.toBeInTheDocument();
  });
});

describe("FormationEditor（段の増減・トグル）", () => {
  it("「+」クリックで段数が増える（API呼び出しなし）", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps()} />);

    expect(screen.getByText("2段")).toBeInTheDocument();
    await user.click(screen.getByTitle("段を追加"));

    expect(screen.getByText("3段")).toBeInTheDocument();
    expect(concertsApi.saveFormationSlots).not.toHaveBeenCalled();
  });

  it("空の末尾の段は「-」クリックでAPI呼び出しなしに削除される", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps()} />);

    await user.click(screen.getByTitle("末尾の段を減らす"));

    expect(screen.getByText("1段")).toBeInTheDocument();
    expect(concertsApi.saveFormationSlots).not.toHaveBeenCalled();
  });

  it("「半人分ずらす」トグルクリックでonIsStaggeredChangedが呼ばれる", async () => {
    const onIsStaggeredChanged = vi.fn();
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ onIsStaggeredChanged })} />);

    await user.click(screen.getByRole("switch"));
    expect(onIsStaggeredChanged).toHaveBeenCalledWith(true);
  });

  it("ピアノ位置「下手」クリックでonPianoPositionChangedが呼ばれる", async () => {
    const onPianoPositionChanged = vi.fn();
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ onPianoPositionChanged })} />);

    await user.click(screen.getByText("下手"));
    expect(onPianoPositionChanged).toHaveBeenCalledWith("kamite");
  });
});

describe("FormationEditor（名前編集・削除）", () => {
  const placedPattern = (memberId: string | null, nameJa: string) =>
    makePattern({
      slots: [
        {
          id: "slot-1",
          memberId,
          nameJa,
          partName: memberId ? "テノール1" : null,
          label: memberId ? null : nameJa,
          boxId: "box-c",
          rowNum: null,
          positionOrder: 1,
        },
      ],
    });

  it("配置済みメンバーの鉛筆から表示名を編集し、✓ で保存する", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern: placedPattern("m1", "山田太郎") })} />);

    await user.click(screen.getByRole("button", { name: "山田太郎の表示名を編集" }));
    const input = screen.getByRole("textbox", { name: "表示名" });
    expect(input).toHaveValue("山田");
    await user.clear(input);
    await user.type(input, "ヤマ");
    await user.click(screen.getByRole("button", { name: "表示名を保存" }));

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "表示名" })).not.toBeInTheDocument();
  });

  it("団員の表示名は空で保存でき、ラベルを外して自動の表示に戻す", async () => {
    const pattern = placedPattern("m1", "山田太郎");
    pattern.slots[0].label = "ヤマ";
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern })} />);

    await user.click(screen.getByRole("button", { name: "山田太郎の表示名を編集" }));
    await user.clear(screen.getByRole("textbox", { name: "表示名" }));
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.getByText("山田")).toBeInTheDocument();
  });

  it("客演の名前は空では保存せず、理由を出す", async () => {
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern: placedPattern(null, "客演太郎") })} />);

    await user.click(screen.getByRole("button", { name: "客演太郎の表示名を編集" }));
    await user.clear(screen.getByRole("textbox", { name: "表示名" }));
    await user.keyboard("{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("名前を入力してください");
    expect(concertsApi.saveFormationSlots).not.toHaveBeenCalled();
  });

  it("配置済みメンバーの✕クリックで削除でき、未配置プールに戻る", async () => {
    const pattern = makePattern({
      slots: [
        {
          id: "slot-1",
          memberId: "m1",
          nameJa: "山田太郎",
          partName: "テノール1",
          label: null,
          boxId: "box-c",
          rowNum: null,
          positionOrder: 1,
        },
      ],
    });
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern })} />);

    expect(screen.queryByTitle("山田太郎")).not.toBeInTheDocument();

    await user.click(screen.getByTitle("削除"));

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(await screen.findByTitle("山田太郎")).toBeInTheDocument();
  });
});

describe("FormationEditor（保存失敗時のロールバック）", () => {
  it("保存に失敗した場合はエラーメッセージを表示し状態を元に戻す", async () => {
    vi.mocked(concertsApi.saveFormationSlots).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps()} />);

    await user.click(screen.getByText("枠を追加"));
    await user.type(screen.getByPlaceholderText("枠の名前"), "ソロ");
    await user.click(screen.getByText("作成"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "フォーメーションの保存に失敗しました。もう一度お試しください。",
    );
    expect(screen.queryByText("ソロ")).not.toBeInTheDocument();
  });

  it("保存の失敗が4xxならAPIの理由を読み上げる", async () => {
    vi.mocked(concertsApi.saveFormationSlots).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "同じ団員を2か所に配置できません", 400),
    );
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps()} />);

    await user.click(screen.getByText("枠を追加"));
    await user.type(screen.getByPlaceholderText("枠の名前"), "ソロ");
    await user.click(screen.getByText("作成"));

    expect(await screen.findByRole("alert")).toHaveTextContent("同じ団員を2か所に配置できません");
  });
});

describe("FormationEditor（ドラッグ&ドロップ）", () => {
  it("未配置プールから山台の空マスへドラッグすると配置される", async () => {
    render(<FormationEditor {...defaultProps()} />);

    const source = screen.getByTitle("山田太郎");
    const emptyCells = Array.from(
      document.querySelectorAll(".border-dashed.border-gray-300"),
    ).filter((el) => el.className.includes("h-11 w-11"));
    const target = emptyCells[0] as HTMLElement;
    expect(target).toBeTruthy();

    dragAndDrop(source, target);

    await waitFor(() => expect(concertsApi.saveFormationSlots).toHaveBeenCalled());
    expect(screen.queryByTitle("山田太郎")).not.toBeInTheDocument();
  });

  it("山台に配置済みの2人のチップをドラッグで入れ替えられる", async () => {
    const pattern = makePattern({
      slots: [
        {
          id: "slot-1",
          memberId: "m1",
          nameJa: "山田太郎",
          partName: "テノール1",
          label: null,
          boxId: null,
          rowNum: 1,
          positionOrder: 1,
        },
        {
          id: "slot-2",
          memberId: "m2",
          nameJa: "鈴木花子",
          partName: "ベース",
          label: null,
          boxId: null,
          rowNum: 1,
          positionOrder: 2,
        },
      ],
    });
    render(<FormationEditor {...defaultProps({ pattern })} />);

    const source = screen.getByTitle("山田太郎（クリックで未配置に戻す）");
    const target = screen
      .getByTitle("鈴木花子（クリックで未配置に戻す）")
      .closest("div") as HTMLElement;

    dragAndDrop(source, target);

    await waitFor(() => expect(concertsApi.saveFormationSlots).toHaveBeenCalled());
    const payload = vi.mocked(concertsApi.saveFormationSlots).mock.calls[0][4];
    const slotsByMember = new Map(payload.slots.map((s) => [s.memberId, s.positionOrder]));
    expect(slotsByMember.get("m1")).toBe(2);
    expect(slotsByMember.get("m2")).toBe(1);
  });
});
