import { formatShortDate, jstDayDiff, jstParts } from "./date";

// 日本時間で今日なら時刻、6日前までは「n日前」、それより前は年/月/日で表示する
export function formatDate(iso: string): string {
  const days = jstDayDiff(iso, new Date());
  if (days <= 0) {
    const { hours, minutes } = jstParts(iso);
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }
  if (days < 7) return `${days}日前`;
  return formatShortDate(iso);
}
