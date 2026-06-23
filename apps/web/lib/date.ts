/** ISO文字列 → "YYYY-MM-DD" */
export function toDateString(isoStr: string): string {
  return isoStr.split("T")[0];
}
