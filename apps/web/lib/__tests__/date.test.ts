import { describe, it, expect, vi, afterEach } from "vitest";
import { toDateString, monthStart, toJstIso, isoToJstParts, todayStr } from "../date";

describe("toDateString", () => {
  it("ISO文字列から日付部分を取り出す", () => {
    expect(toDateString("2026-07-14T10:00:00+09:00")).toBe("2026-07-14");
  });
});

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
