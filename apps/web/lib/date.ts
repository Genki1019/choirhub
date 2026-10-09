/** year/month → "YYYY-MM-01" */
export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** year/month → 月末日 "YYYY-MM-DD" */
export function monthEnd(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
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

export interface JstParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hours: number;
  minutes: number;
}

/** 日時（ISO文字列・Date）→ 日本時間の各部分。ブラウザのタイムゾーンによらない */
export function jstParts(value: string | Date): JstParts {
  const d = new Date(new Date(value).getTime() + JST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

/** from から to まで、日本時間の暦で何日あるか（同じ日なら 0、to が前なら負） */
export function jstDayDiff(from: string | Date, to: string | Date): number {
  const dayStart = ({ year, month, day }: JstParts) => Date.UTC(year, month - 1, day);
  return Math.round((dayStart(jstParts(to)) - dayStart(jstParts(from))) / 86400000);
}

/** 日時 → "YYYY年M月D日"（日本時間） */
export function formatJaDate(value: string | Date): string {
  const { year, month, day } = jstParts(value);
  return `${year}年${month}月${day}日`;
}

/** 日時 → "YYYY年M月D日 H:MM"（日本時間） */
export function formatJaDateTime(value: string | Date): string {
  const { year, month, day, hours, minutes } = jstParts(value);
  return `${year}年${month}月${day}日 ${hours}:${String(minutes).padStart(2, "0")}`;
}

/** 日時 → "YYYY/M/D"（日本時間） */
export function formatShortDate(value: string | Date): string {
  const { year, month, day } = jstParts(value);
  return `${year}/${month}/${day}`;
}
