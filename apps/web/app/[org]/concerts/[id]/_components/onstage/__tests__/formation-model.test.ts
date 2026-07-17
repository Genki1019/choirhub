import { describe, it, expect } from "vitest";
import {
  boxDisplayTitle,
  rowKey,
  rowNumOf,
  isRiserRow,
  riserRowKeys,
  assignmentToSlotItem,
  buildPlacedState,
  flattenPlaced,
  buildSlotsPayload,
  toFormationDetails,
  findContainer,
  removeMemberFromRisers,
  cellId,
  parseCellId,
  isItemId,
  displayLabelOf,
  buildPartColorMap,
} from "../formation-model";
import type { BoxMeta, Containers, SlotItem } from "../types";
import type {
  AssignmentDetail,
  FormationPatternDetail,
  FormationSlotDetail,
} from "@/lib/concerts-api";

describe("boxDisplayTitle", () => {
  it("conductorは「指揮」を返す", () => {
    expect(boxDisplayTitle({ key: "b1", kind: "conductor", title: null, sortOrder: 0 })).toBe(
      "指揮",
    );
  });
  it("pianoは「ピアノ」を返す", () => {
    expect(boxDisplayTitle({ key: "b1", kind: "piano", title: null, sortOrder: 0 })).toBe("ピアノ");
  });
  it("customはtitleをそのまま返す", () => {
    expect(boxDisplayTitle({ key: "b1", kind: "custom", title: "ソロ", sortOrder: 0 })).toBe(
      "ソロ",
    );
  });
  it("customでtitleがnullの場合は空文字を返す", () => {
    expect(boxDisplayTitle({ key: "b1", kind: "custom", title: null, sortOrder: 0 })).toBe("");
  });
});

describe("rowKey / rowNumOf / isRiserRow", () => {
  it("rowKeyは r{n} 形式の文字列を返す", () => {
    expect(rowKey(1)).toBe("r1");
    expect(rowKey(12)).toBe("r12");
  });
  it("rowNumOfはrowKeyの逆変換をする", () => {
    expect(rowNumOf("r3")).toBe(3);
  });
  it("isRiserRowはr{数字}形式のみtrueを返す", () => {
    expect(isRiserRow("r1")).toBe(true);
    expect(isRiserRow("r12")).toBe(true);
    expect(isRiserRow("box:abc")).toBe(false);
    expect(isRiserRow("unassigned")).toBe(false);
  });
});

describe("riserRowKeys", () => {
  it("山台の行キーのみを行番号順に抽出する", () => {
    const containers: Containers = { r2: [], "box:1": [], r1: [], unassigned: [] };
    expect(riserRowKeys(containers)).toEqual(["r1", "r2"]);
  });
});

describe("assignmentToSlotItem", () => {
  it("m:memberId形式のキーでSlotItemを組み立てる", () => {
    const a: AssignmentDetail = {
      memberId: "member-1",
      nameJa: "山田太郎",
      partId: "p1",
      partName: "テノール1",
      partSortOrder: 1,
      partVoiceType: "tenor1",
      stageId: "stage-1",
      status: "on",
    };
    expect(assignmentToSlotItem(a)).toEqual({
      key: "m:member-1",
      memberId: "member-1",
      label: null,
      name: "山田太郎",
      partName: "テノール1",
    });
  });

  it("labelを渡すとそのまま設定される", () => {
    const a: AssignmentDetail = {
      memberId: "member-1",
      nameJa: "山田太郎",
      partId: null,
      partName: null,
      partSortOrder: 0,
      partVoiceType: "",
      stageId: "stage-1",
      status: "on",
    };
    expect(assignmentToSlotItem(a, "ヤマ").label).toBe("ヤマ");
  });
});

describe("buildPlacedState", () => {
  function makeSlot(overrides: Partial<FormationSlotDetail>): FormationSlotDetail {
    return {
      id: "slot-1",
      memberId: "member-1",
      nameJa: "山田太郎",
      partName: "テノール1",
      label: null,
      boxId: null,
      rowNum: null,
      positionOrder: 1,
      ...overrides,
    };
  }

  it("boxes・山台行を含む配置状況を組み立てる", () => {
    const pattern: FormationPatternDetail = {
      id: "pattern-1",
      name: "パターン1",
      sortOrder: 0,
      isStaggered: false,
      pianoPosition: "center",
      boxes: [
        { id: "box-conductor", kind: "conductor", title: null, sortOrder: 0 },
        { id: "box-piano", kind: "piano", title: null, sortOrder: 1 },
      ],
      slots: [
        makeSlot({ id: "s1", boxId: "box-conductor", positionOrder: 1 }),
        makeSlot({ id: "s2", rowNum: 1, positionOrder: 1, memberId: "member-2" }),
      ],
    };

    const { placed, boxes } = buildPlacedState(pattern, 2);

    expect(boxes.map((b) => b.key)).toEqual(["box-conductor", "box-piano"]);
    expect(placed["box-conductor"]).toHaveLength(1);
    expect(placed["box-conductor"][0].key).toBe("i:s1");
    expect(placed.r1).toHaveLength(1);
    expect(placed.r2).toEqual([]); // minRows: 2 なので空でも存在する
  });

  it("配置済みslotのrowNumがminRowsを超える場合はその段まで生成する", () => {
    const pattern: FormationPatternDetail = {
      id: "pattern-1",
      name: "パターン1",
      sortOrder: 0,
      isStaggered: false,
      pianoPosition: "center",
      boxes: [],
      slots: [makeSlot({ id: "s1", rowNum: 5, positionOrder: 1 })],
    };

    const { placed } = buildPlacedState(pattern, 2);
    expect(Object.keys(placed).filter((k) => /^r\d+$/.test(k))).toHaveLength(5);
  });

  it("山台アイテムのcolはpositionOrderから設定される", () => {
    const pattern: FormationPatternDetail = {
      id: "pattern-1",
      name: "パターン1",
      sortOrder: 0,
      isStaggered: false,
      pianoPosition: "center",
      boxes: [],
      slots: [makeSlot({ id: "s1", rowNum: 1, positionOrder: 3 })],
    };

    const { placed } = buildPlacedState(pattern, 1);
    expect(placed.r1[0].col).toBe(3);
  });
});

describe("flattenPlaced", () => {
  it("boxとriserを1本のリストに平坦化する", () => {
    const placed: Containers = {
      "box-1": [{ key: "i:a", memberId: "m1", label: null, name: "A", partName: null }],
      r1: [{ key: "i:b", memberId: "m2", label: null, name: "B", partName: null, col: 2 }],
    };
    const flat = flattenPlaced(placed);

    expect(flat).toContainEqual(
      expect.objectContaining({ key: "i:a", boxKey: "box-1", rowNum: null, positionOrder: 1 }),
    );
    expect(flat).toContainEqual(
      expect.objectContaining({ key: "i:b", boxKey: null, rowNum: 1, positionOrder: 2 }),
    );
  });

  it("colが無い山台アイテムはインデックス+1をpositionOrderにする", () => {
    const placed: Containers = {
      r1: [{ key: "i:a", memberId: null, label: "客演", name: "客演", partName: null }],
    };
    expect(flattenPlaced(placed)[0].positionOrder).toBe(1);
  });
});

describe("buildSlotsPayload / toFormationDetails", () => {
  const boxes: BoxMeta[] = [{ key: "box-1", kind: "custom", title: "ソロ", sortOrder: 0 }];
  const placed: Containers = {
    "box-1": [{ key: "i:a", memberId: "m1", label: null, name: "山田太郎", partName: "テノール1" }],
  };

  it("buildSlotsPayloadはAPI送信用の形に変換する", () => {
    const payload = buildSlotsPayload(placed, boxes);
    expect(payload.boxes).toEqual([
      { clientId: "box-1", kind: "custom", title: "ソロ", sortOrder: 0 },
    ]);
    expect(payload.slots).toEqual([
      {
        memberId: "m1",
        label: undefined,
        boxClientId: "box-1",
        rowNum: undefined,
        positionOrder: 1,
      },
    ]);
  });

  it("toFormationDetailsは楽観的更新用のDetail形に変換する", () => {
    const details = toFormationDetails(placed, boxes);
    expect(details.boxes).toEqual([{ id: "box-1", kind: "custom", title: "ソロ", sortOrder: 0 }]);
    expect(details.slots).toEqual([
      {
        id: "i:a",
        memberId: "m1",
        nameJa: "山田太郎",
        partName: "テノール1",
        label: null,
        boxId: "box-1",
        rowNum: null,
        positionOrder: 1,
      },
    ]);
  });
});

describe("findContainer", () => {
  it("アイテムを含むコンテナのキーを返す", () => {
    const containers: Containers = {
      "box-1": [{ key: "i:a", memberId: null, label: null, name: "A", partName: null }],
    };
    expect(findContainer(containers, "i:a")).toBe("box-1");
  });

  it("見つからない場合はundefinedを返す", () => {
    expect(findContainer({}, "i:missing")).toBeUndefined();
  });
});

describe("removeMemberFromRisers", () => {
  it("山台からのみ指定メンバーを取り除き、box内は変更しない", () => {
    const item: SlotItem = { key: "i:a", memberId: "m1", label: null, name: "A", partName: null };
    const containers: Containers = {
      r1: [item],
      "box-1": [item],
    };
    const next = removeMemberFromRisers(containers, "m1");
    expect(next.r1).toEqual([]);
    expect(next["box-1"]).toEqual([item]);
  });
});

describe("cellId / parseCellId", () => {
  it("cellIdは cell:{row}:{col} 形式を生成する", () => {
    expect(cellId("r1", 3)).toBe("cell:r1:3");
  });

  it("parseCellIdは行と列を復元する", () => {
    expect(parseCellId("cell:r1:3")).toEqual({ row: "r1", col: 3 });
  });

  it("cell:接頭辞が無い場合はnullを返す", () => {
    expect(parseCellId("r1")).toBeNull();
  });

  it("colが数値でない場合はnullを返す", () => {
    expect(parseCellId("cell:r1:abc")).toBeNull();
  });
});

describe("isItemId", () => {
  it("m:またはi:で始まる文字列はtrue", () => {
    expect(isItemId("m:member-1")).toBe(true);
    expect(isItemId("i:slot-1")).toBe(true);
  });
  it("それ以外はfalse", () => {
    expect(isItemId("box-1")).toBe(false);
    expect(isItemId(123)).toBe(false);
  });
});

describe("displayLabelOf", () => {
  it("labelがあればそれを返す", () => {
    const item: SlotItem = {
      key: "i:a",
      memberId: "m1",
      label: "ヤマ",
      name: "山田太郎",
      partName: null,
    };
    expect(displayLabelOf(item)).toBe("ヤマ");
  });

  it("memberIdが無い場合（客演）はnameをそのまま返す", () => {
    const item: SlotItem = {
      key: "i:a",
      memberId: null,
      label: null,
      name: "客演太郎",
      partName: null,
    };
    expect(displayLabelOf(item)).toBe("客演太郎");
  });

  it("labelが無くmemberIdがある場合は姓の先頭2文字を返す", () => {
    const item: SlotItem = {
      key: "i:a",
      memberId: "m1",
      label: null,
      name: "山田 太郎",
      partName: null,
    };
    expect(displayLabelOf(item)).toBe("山田");
  });

  it("姓が2文字未満の場合はそのまま返す", () => {
    const item: SlotItem = { key: "i:a", memberId: "m1", label: null, name: "王", partName: null };
    expect(displayLabelOf(item)).toBe("王");
  });
});

describe("buildPartColorMap", () => {
  it("パート名ごとに一貫した色を割り当てる（comparePartOrder順）", () => {
    const assignments: AssignmentDetail[] = [
      {
        memberId: "m1",
        nameJa: "A",
        partId: "p1",
        partName: "ベース",
        partSortOrder: 2,
        partVoiceType: "bass1",
        stageId: "s1",
        status: "on",
      },
      {
        memberId: "m2",
        nameJa: "B",
        partId: "p2",
        partName: "テノール1",
        partSortOrder: 1,
        partVoiceType: "tenor1",
        stageId: "s1",
        status: "on",
      },
    ];

    const map = buildPartColorMap(assignments);
    const keys = [...map.keys()];
    expect(keys).toEqual(["テノール1", "ベース"]);
    expect(map.get("テノール1")).not.toEqual(map.get("ベース"));
  });

  it("partNameがnullのメンバーは無視する", () => {
    const assignments: AssignmentDetail[] = [
      {
        memberId: "m1",
        nameJa: "A",
        partId: null,
        partName: null,
        partSortOrder: 0,
        partVoiceType: "",
        stageId: "s1",
        status: "on",
      },
    ];
    expect(buildPartColorMap(assignments).size).toBe(0);
  });
});
