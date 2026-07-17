import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormationEditor } from "../FormationEditor";
import {
  concertsApi,
  type AssignmentDetail,
  type FormationPatternDetail,
} from "@/lib/concerts-api";
import { buildPartColorMap } from "../formation-model";

// dnd-kitのPointerSensorをjsdomで動かすためのヘルパー・ポリフィル
function mockRect(el: Element, rect: { x: number; y: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      toJSON() {
        return this;
      },
    }) as DOMRect;
}

function dragAndDrop(source: Element, target: Element) {
  mockRect(source, { x: 0, y: 0, width: 44, height: 44 });
  mockRect(target, { x: 300, y: 0, width: 44, height: 44 });

  fireEvent.pointerDown(source, {
    pointerId: 1,
    clientX: 22,
    clientY: 22,
    button: 0,
    isPrimary: true,
  });
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 322, clientY: 22, isPrimary: true });
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 322, clientY: 22, isPrimary: true });
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 322, clientY: 22, isPrimary: true });
}

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
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
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

  it("カスタム枠の✏️クリックで枠名を編集できる", async () => {
    const pattern = makePattern({
      boxes: [
        { id: "box-c", kind: "conductor", title: null, sortOrder: 0 },
        { id: "box-p", kind: "piano", title: null, sortOrder: 1 },
        { id: "box-solo", kind: "custom", title: "ソロ", sortOrder: 2 },
      ],
    });
    const user = userEvent.setup();
    render(<FormationEditor {...defaultProps({ pattern })} />);

    await user.click(screen.getByTitle("枠名を編集"));
    const input = screen.getByDisplayValue("ソロ");
    await user.clear(input);
    await user.type(input, "独唱{Enter}");

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
    expect(screen.getByText("独唱")).toBeInTheDocument();
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
  it("配置済みメンバーの鉛筆アイコンから表示名を編集できる", async () => {
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

    await user.click(screen.getByTitle("表示名を編集"));

    const input = screen.getByDisplayValue("山田");
    await user.clear(input);
    await user.type(input, "ヤマ");
    await user.click(screen.getByText("保存"));

    expect(concertsApi.saveFormationSlots).toHaveBeenCalled();
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

    expect(
      await screen.findByText("フォーメーションの保存に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("ソロ")).not.toBeInTheDocument();
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
