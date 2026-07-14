import type { FormationBoxKind } from "@/lib/concerts-api";

export interface SlotItem {
  key: string;
  memberId: string | null;
  label: string | null;
  name: string;
  partName: string | null;
  col?: number; // 山台グリッドでの列位置（1始まり）。山台以外では未使用
}

// 山台は "r{n}"（n>=1）、指揮・ピアノ・カスタム枠は BoxMeta.key をそのままキーに使う
export type Containers = Record<string, SlotItem[]>;

export interface BoxMeta {
  key: string;
  kind: FormationBoxKind;
  title: string | null; // custom のみ表示名として使う。conductor/piano は固定文言（"指揮"/"ピアノ"）
  sortOrder: number;
}

export interface PartColor {
  bg: string;
  border: string;
}
