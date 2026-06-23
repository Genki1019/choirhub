/** Date → "YYYY-MM-DD" (UTC) */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}
