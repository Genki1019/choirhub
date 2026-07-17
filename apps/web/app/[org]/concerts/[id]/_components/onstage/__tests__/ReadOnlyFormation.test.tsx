import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadOnlyFormation } from "../ReadOnlyFormation";
import type { FormationPatternDetail, FormationSlotDetail } from "@/lib/concerts-api";
import type { PartColor } from "../types";

function makeSlot(overrides: Partial<FormationSlotDetail>): FormationSlotDetail {
  return {
    id: "slot-1",
    memberId: "m1",
    nameJa: "山田太郎",
    partName: "テノール1",
    label: null,
    boxId: null,
    rowNum: null,
    positionOrder: 1,
    ...overrides,
  };
}

function makePattern(overrides: Partial<FormationPatternDetail> = {}): FormationPatternDetail {
  return {
    id: "pattern-1",
    name: "パターン1",
    sortOrder: 0,
    isStaggered: false,
    pianoPosition: "center",
    boxes: [],
    slots: [],
    ...overrides,
  };
}

const partColorMap = new Map<string, PartColor>([
  ["テノール1", { bg: "bg-blue-50", border: "border-blue-200" }],
]);

describe("ReadOnlyFormation（空状態）", () => {
  it("全て空の場合は案内メッセージを表示する", () => {
    render(<ReadOnlyFormation pattern={makePattern()} partColorMap={partColorMap} />);
    expect(screen.getByText("フォーメーションはまだ設定されていません")).toBeInTheDocument();
  });
});

describe("ReadOnlyFormation（指揮・ピアノ・山台）", () => {
  it("指揮・ピアノ・山台のメンバーを表示する", () => {
    const pattern = makePattern({
      boxes: [
        { id: "box-c", kind: "conductor", title: null, sortOrder: 0 },
        { id: "box-p", kind: "piano", title: null, sortOrder: 1 },
      ],
      slots: [
        makeSlot({ id: "s1", boxId: "box-c", nameJa: "指揮太郎" }),
        makeSlot({ id: "s2", boxId: "box-p", memberId: "m2", nameJa: "ピアノ子" }),
        makeSlot({
          id: "s3",
          boxId: null,
          rowNum: 1,
          positionOrder: 1,
          memberId: "m3",
          nameJa: "山台太郎",
        }),
      ],
    });
    render(<ReadOnlyFormation pattern={pattern} partColorMap={partColorMap} />);

    expect(screen.getAllByText("指揮").length).toBeGreaterThan(0);
    expect(screen.getByTitle("指揮太郎")).toBeInTheDocument();
    expect(screen.getByText("ピアノ")).toBeInTheDocument();
    expect(screen.getByTitle("ピアノ子")).toBeInTheDocument();
    expect(screen.getByText("1段目")).toBeInTheDocument();
    expect(screen.getByTitle("山台太郎")).toBeInTheDocument();
  });

  it("ピアノ位置がkamiteの場合はtransformスタイルを適用する", () => {
    const pattern = makePattern({
      boxes: [{ id: "box-p", kind: "piano", title: null, sortOrder: 0 }],
      slots: [makeSlot({ id: "s1", boxId: "box-p", nameJa: "ピアノ子" })],
      pianoPosition: "kamite",
    });
    render(<ReadOnlyFormation pattern={pattern} partColorMap={partColorMap} />);

    const pianoChip = screen.getByTitle("ピアノ子");
    const wrapper = pianoChip.closest("div.flex.gap-2") as HTMLElement;
    expect(wrapper.getAttribute("style")).toContain("translateX");
  });
});

describe("ReadOnlyFormation（カスタム枠）", () => {
  it("カスタム枠のタイトルとoccupantsを表示する", () => {
    const pattern = makePattern({
      boxes: [{ id: "box-solo", kind: "custom", title: "ソロ", sortOrder: 0 }],
      slots: [makeSlot({ id: "s1", boxId: "box-solo", nameJa: "独唱太郎" })],
    });
    render(<ReadOnlyFormation pattern={pattern} partColorMap={partColorMap} />);

    expect(screen.getByText("ソロ・楽器")).toBeInTheDocument();
    expect(screen.getByText("ソロ")).toBeInTheDocument();
    expect(screen.getByTitle("独唱太郎")).toBeInTheDocument();
  });

  it("occupantsが0件の場合は「（未配置）」を表示する", () => {
    const pattern = makePattern({
      boxes: [{ id: "box-solo", kind: "custom", title: "ソロ", sortOrder: 0 }],
      slots: [],
    });
    render(<ReadOnlyFormation pattern={pattern} partColorMap={partColorMap} />);

    expect(screen.getByText("（未配置）")).toBeInTheDocument();
  });
});
