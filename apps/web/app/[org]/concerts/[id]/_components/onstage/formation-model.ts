import type { AssignmentDetail, FormationBoxDetail, FormationPatternDetail, FormationSlotDetail } from "@/lib/concerts-api";
import { comparePartOrder } from "@/lib/voice-order";
import type { BoxMeta, Containers, PartColor, SlotItem } from "./types";

// チップの直径（Chips.tsx の w-11/h-11 と一致させる）とチップ間の間隔（gap-2 と一致させる）
export const CHIP_SIZE_PX = 44;
export const CHIP_GAP_PX = 8;

export const GRID_CELL_STEP = CHIP_SIZE_PX + CHIP_GAP_PX;
export const GRID_STAGGER_OFFSET = GRID_CELL_STEP / 2;

export function boxDisplayTitle(box: BoxMeta): string {
  if (box.kind === "conductor") return "指揮";
  if (box.kind === "piano") return "ピアノ";
  return box.title ?? "";
}

export function rowKey(n: number): string {
  return `r${n}`;
}

export function rowNumOf(key: string): number {
  return Number(key.slice(1));
}

export function isRiserRow(key: string): boolean {
  return /^r\d+$/.test(key);
}

export function riserRowKeys(containers: Containers): string[] {
  return Object.keys(containers).filter(isRiserRow).sort((a, b) => rowNumOf(a) - rowNumOf(b));
}

// 配置済みインスタンスのキーは常に `i:` 接頭辞（一意なslot単位）。
// `m:` は「未配置プール」上の団員仮想表示専用のキーで、配置済みキーとは衝突しない
// （同じ団員をソロ枠と山台の両方に重複登録できるようにするため）。
function slotToItem(slot: FormationSlotDetail): SlotItem {
  return {
    key: `i:${slot.id}`,
    memberId: slot.memberId,
    label: slot.label,
    name: slot.memberId ? (slot.nameJa ?? "") : (slot.label ?? ""),
    partName: slot.partName,
    col: slot.boxId == null ? (slot.positionOrder ?? undefined) : undefined,
  };
}

export function assignmentToSlotItem(a: AssignmentDetail, label: string | null = null): SlotItem {
  return { key: `m:${a.memberId}`, memberId: a.memberId, label, name: a.nameJa, partName: a.partName };
}

// パターンの boxes/slots から、配置状況（Containers）と枠メタ情報（BoxMeta[]）を組み立てる
export function buildPlacedState(pattern: FormationPatternDetail, minRows: number): { placed: Containers; boxes: BoxMeta[] } {
  const boxes: BoxMeta[] = pattern.boxes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({ key: b.id, kind: b.kind, title: b.title, sortOrder: b.sortOrder }));

  const riserNums = pattern.slots.map((s) => s.rowNum).filter((n): n is number => n != null);
  const maxRiser = Math.max(minRows, riserNums.length > 0 ? Math.max(...riserNums) : 0, 1);

  const placed: Containers = {};
  boxes.forEach((b) => { placed[b.key] = []; });
  for (let rn = 1; rn <= maxRiser; rn++) placed[rowKey(rn)] = [];

  const byContainer = new Map<string, FormationSlotDetail[]>();
  pattern.slots.forEach((s) => {
    const key = s.boxId ?? (s.rowNum != null ? rowKey(s.rowNum) : null);
    if (key == null) return;
    if (!byContainer.has(key)) byContainer.set(key, []);
    byContainer.get(key)!.push(s);
  });
  for (const [key, list] of byContainer) {
    placed[key] = list.sort((a, b) => a.positionOrder - b.positionOrder).map(slotToItem);
  }
  return { placed, boxes };
}

interface FlatSlot {
  key: string;
  memberId: string | null;
  label: string | null;
  name: string;
  partName: string | null;
  boxKey: string | null;
  rowNum: number | null;
  positionOrder: number;
}

// Containers を「枠か山台か」で分岐しつつ1本のリストに平坦化する
export function flattenPlaced(placed: Containers): FlatSlot[] {
  const result: FlatSlot[] = [];
  Object.keys(placed).forEach((key) => {
    const isBox = !isRiserRow(key);
    placed[key].forEach((item, i) => {
      result.push({
        key: item.key,
        memberId: item.memberId,
        label: item.label,
        name: item.name,
        partName: item.partName,
        boxKey: isBox ? key : null,
        rowNum: isBox ? null : rowNumOf(key),
        positionOrder: isBox ? i + 1 : (item.col ?? i + 1),
      });
    });
  });
  return result;
}

export function buildSlotsPayload(placed: Containers, boxes: BoxMeta[]) {
  return {
    boxes: boxes.map((b) => ({ clientId: b.key, kind: b.kind, title: b.title ?? undefined, sortOrder: b.sortOrder })),
    slots: flattenPlaced(placed).map((s) => ({
      memberId: s.memberId ?? undefined,
      label: s.label ?? undefined,
      boxClientId: s.boxKey ?? undefined,
      rowNum: s.rowNum ?? undefined,
      positionOrder: s.positionOrder,
    })),
  };
}

// 保存成功後、楽観的にローカルの ConcertDetail キャッシュへ反映するための形へ変換する
export function toFormationDetails(placed: Containers, boxes: BoxMeta[]): { boxes: FormationBoxDetail[]; slots: FormationSlotDetail[] } {
  return {
    boxes: boxes.map((b) => ({ id: b.key, kind: b.kind, title: b.title, sortOrder: b.sortOrder })),
    slots: flattenPlaced(placed).map((s) => ({
      id: s.key,
      memberId: s.memberId,
      nameJa: s.memberId ? s.name : null,
      partName: s.partName,
      label: s.label,
      boxId: s.boxKey,
      rowNum: s.rowNum,
      positionOrder: s.positionOrder,
    })),
  };
}

export function findContainer(containers: Containers, key: string): string | undefined {
  return Object.keys(containers).find((k) => containers[k].some((item) => item.key === key));
}

// 指揮・ピアノに配置した団員は山台には立てないため、既に山台に重複配置されていれば取り除く
export function removeMemberFromRisers(containers: Containers, memberId: string): Containers {
  const next = { ...containers };
  Object.keys(next).forEach((key) => {
    if (isRiserRow(key)) {
      next[key] = next[key].filter((i) => i.memberId !== memberId);
    }
  });
  return next;
}

// 山台は扇形配置で隙間ができうるグリッドなので、行コンテナではなくマス（行×列）単位で
// ドロップ先を識別する。行キー自体はコロンを含まないため、先頭の "cell:" を除いた
// 残り文字列の最後のコロンで行と列を分離できる。
export function cellId(row: string, col: number): string {
  return `cell:${row}:${col}`;
}

export function parseCellId(id: string): { row: string; col: number } | null {
  if (!id.startsWith("cell:")) return null;
  const rest = id.slice("cell:".length);
  const sep = rest.lastIndexOf(":");
  if (sep === -1) return null;
  const col = Number(rest.slice(sep + 1));
  if (!Number.isFinite(col)) return null;
  return { row: rest.slice(0, sep), col };
}

export function isItemId(id: string | number): boolean {
  return typeof id === "string" && (id.startsWith("m:") || id.startsWith("i:"));
}

// 丸バッジ内に表示する短い名前。あだ名（枠ごとに手入力した label）があればそれを使い、
// 無ければ姓の先頭1〜2文字を自動表示する（同姓がいる場合などは手入力で上書きする想定）
export function displayLabelOf(item: SlotItem): string {
  if (item.label) return item.label;
  if (!item.memberId) return item.name;
  const surname = item.name.trim().split(/[\s　]+/)[0] || item.name;
  return surname.slice(0, 2);
}

export const PART_COLOR_PALETTE: PartColor[] = [
  { bg: "bg-blue-50", border: "border-blue-200" },
  { bg: "bg-purple-50", border: "border-purple-200" },
  { bg: "bg-amber-50", border: "border-amber-200" },
  { bg: "bg-rose-50", border: "border-rose-200" },
  { bg: "bg-teal-50", border: "border-teal-200" },
  { bg: "bg-indigo-50", border: "border-indigo-200" },
  { bg: "bg-orange-50", border: "border-orange-200" },
  { bg: "bg-cyan-50", border: "border-cyan-200" },
];

// パート名ごとに一貫した色を割り当てる（並び順は他画面と同じ comparePartOrder に揃える）
export function buildPartColorMap(assignments: AssignmentDetail[]): Map<string, PartColor> {
  const orderByPart = new Map<string, { sortOrder: number; voiceType: string }>();
  assignments.forEach((a) => {
    if (a.partName && !orderByPart.has(a.partName)) {
      orderByPart.set(a.partName, { sortOrder: a.partSortOrder, voiceType: a.partVoiceType });
    }
  });
  const sorted = [...orderByPart.entries()].sort((a, b) => comparePartOrder(a[1], b[1]));
  const map = new Map<string, PartColor>();
  sorted.forEach(([partName], i) => map.set(partName, PART_COLOR_PALETTE[i % PART_COLOR_PALETTE.length]));
  return map;
}
