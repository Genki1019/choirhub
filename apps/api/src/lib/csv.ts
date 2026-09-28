import type { Context } from "hono";
import { toJstDateString } from "./date.js";

type CsvCell = string | number | null | undefined;

const BOM = "\uFEFF";
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NEEDS_QUOTE = /[",\r\n]/;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  return NEEDS_QUOTE.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

export function csvResponse(c: Context, filename: string, csv: string): Response {
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  });
}

export function csvFilename(prefix: string, now = new Date()): string {
  return `${prefix}_${toJstDateString(now).replace(/-/g, "")}.csv`;
}
