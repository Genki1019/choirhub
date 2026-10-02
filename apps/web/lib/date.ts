/** year/month → "YYYY-MM-01" */
export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "YYYY-MM-DD" + "HH:MM" → JST ISO文字列 */
export function toJstIso(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

/** JST ISO文字列 → { date: "YYYY-MM-DD", time: "HH:MM" } */
export function isoToJstParts(iso: string): { date: string; time: string } {
  const jst = new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString();
  return { date: jst.slice(0, 10), time: jst.slice(11, 16) };
}

/** JSTでの今日の日付を "YYYY-MM-DD" で返す */
export function todayStr(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO文字列 → "YYYY年M月D日" */
export function formatJaDate(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** ISO文字列 → "YYYY年M月D日 H:MM" */
export function formatJaDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
