import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  monthStart,
  toJstIso,
  isoToJstParts,
  todayStr,
  jstParts,
  formatJaDate,
  formatJaDateTime,
  formatShortDate,
  jstDayDiff,
} from "../date";

describe("monthStart", () => {
  it("year/monthから月初日を組み立てる", () => {
    expect(monthStart(2026, 7)).toBe("2026-07-01");
  });

  it("1桁の月をゼロ埋めする", () => {
    expect(monthStart(2026, 3)).toBe("2026-03-01");
  });
});

describe("toJstIso / isoToJstParts", () => {
  it("date/timeからJST ISO文字列を組み立て、元のdate/timeに戻せる", () => {
    const iso = toJstIso("2026-07-14", "14:00");
    expect(iso).toBe("2026-07-14T14:00:00+09:00");
    expect(isoToJstParts(iso)).toEqual({ date: "2026-07-14", time: "14:00" });
  });
});

describe("todayStr", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("JSTの0〜9時でもJSTの日付を返す", () => {
    vi.useFakeTimers({ now: new Date("2026-09-28T23:00:00Z") });
    expect(todayStr()).toBe("2026-09-29");
  });

  it("JSTの23時台は当日の日付を返す", () => {
    vi.useFakeTimers({ now: new Date("2026-09-29T14:59:59Z") });
    expect(todayStr()).toBe("2026-09-29");
  });

  it("ブラウザのタイムゾーンによらずJSTの日付を返す", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      // JST 2026-09-29 11:00、ロサンゼルスでは 9/28 19:00
      vi.useFakeTimers({ now: new Date("2026-09-29T02:00:00Z") });
      expect(todayStr()).toBe("2026-09-29");
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

describe("日本時間のヘルパー（ブラウザのタイムゾーンによらない）", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "America/Los_Angeles");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("jstParts: UTC 15:30 は日本時間の翌日 0:30", () => {
    expect(jstParts("2026-11-22T15:30:00Z")).toEqual({
      year: 2026,
      month: 11,
      day: 23,
      weekday: 1,
      hours: 0,
      minutes: 30,
    });
  });

  it("jstParts: 日付だけの文字列（UTC 0時）は同じ日付", () => {
    expect(jstParts("2026-11-23")).toMatchObject({ year: 2026, month: 11, day: 23 });
  });

  it("jstDayDiff: 日本時間の暦の日付の差を返す（時刻の差ではない）", () => {
    expect(jstDayDiff("2026-11-22T14:59:00Z", "2026-11-22T15:00:00Z")).toBe(1);
    expect(jstDayDiff("2026-11-22T15:00:00Z", "2026-11-23T14:59:00Z")).toBe(0);
    expect(jstDayDiff("2026-11-25T00:00:00Z", "2026-11-22T00:00:00Z")).toBe(-3);
  });

  it("formatJaDate・formatJaDateTime・formatShortDate は日本時間で表示する", () => {
    expect(formatJaDate("2026-11-22T15:30:00Z")).toBe("2026年11月23日");
    expect(formatJaDateTime("2026-11-22T15:30:00Z")).toBe("2026年11月23日 0:30");
    expect(formatShortDate("2026-11-22T15:30:00Z")).toBe("2026/11/23");
  });
});
