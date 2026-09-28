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
