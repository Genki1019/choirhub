/** ISO文字列 → "YYYY-MM-DD" */
export function toDateString(isoStr: string): string {
  return isoStr.split("T")[0];
}

/** year/month → "YYYY-MM-01" */
export function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
