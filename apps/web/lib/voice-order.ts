/**
 * 声域の高い順（小さい値 = 高い声）
 * 混声・女声・男声・学生合唱で使われる一般的なパート名に対応
 */
const VOICE_TYPE_ORDER: Record<string, number> = {
  // 女声 / 混声上声部
  soprano: 1,
  "soprano-1": 1,
  "soprano-2": 2,
  "mezzo-soprano": 3,
  mezzo: 3,
  alto: 4,
  contralto: 4,
  // 男声
  tenor: 5,
  "tenor-1": 5,
  "tenor-2": 6,
  countertenor: 5,
  baritone: 7,
  "bass-baritone": 8,
  bass: 9,
  // その他
  other: 99,
};

/**
 * voiceType と sortOrder を組み合わせてパートを高い声から順に並べる比較関数
 * - sortOrder が設定されていれば優先
 * - 同値 or 未設定なら voiceType の声域順にフォールバック
 */
export function comparePartOrder(
  a: { voiceType: string; sortOrder: number },
  b: { voiceType: string; sortOrder: number },
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const oa = VOICE_TYPE_ORDER[a.voiceType.toLowerCase()] ?? 50;
  const ob = VOICE_TYPE_ORDER[b.voiceType.toLowerCase()] ?? 50;
  return oa - ob;
}
