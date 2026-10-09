/** Date → "YYYY-MM-DD" (UTC) */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date → "YYYY-MM-DD" (JST) */
export function toJstDateString(date: Date): string {
  return toDateString(new Date(date.getTime() + JST_OFFSET_MS));
}

/** Date → "YYYY-MM-DD HH:mm" (JST) */
export function toJstDateTimeString(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD"（JST）→ その日の JST 0時 */
export function jstDayStart(jstDate: string): Date {
  return new Date(`${jstDate}T00:00:00+09:00`);
}

/** "YYYY-MM-DD"（JST）→ 翌日の JST 0時（その日を含む期間の終端に使う） */
export function jstDayEnd(jstDate: string): Date {
  return new Date(jstDayStart(jstDate).getTime() + DAY_MS);
}

/** JSTの時刻を保ったまま、日付だけ "YYYY-MM-DD"（JST）に差し替える */
export function withJstDate(date: Date, jstDate: string): Date {
  const timeOfDayMs = (((date.getTime() + JST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return new Date(Date.parse(`${jstDate}T00:00:00Z`) - JST_OFFSET_MS + timeOfDayMs);
}
