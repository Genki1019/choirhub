import { describe, it, expect } from "vitest";
import { toDateString, toJstDateString, toJstDateTimeString, withJstDate } from "../date.js";

describe("toDateString", () => {
  it("UTCの日付を返す", () => {
    expect(toDateString(new Date("2026-09-28T16:00:00Z"))).toBe("2026-09-28");
  });
});

describe("toJstDateString", () => {
  it("UTC15時以降は翌日（JST）の日付を返す", () => {
    expect(toJstDateString(new Date("2026-09-28T15:00:00Z"))).toBe("2026-09-29");
  });

  it("UTC15時より前は同日の日付を返す", () => {
    expect(toJstDateString(new Date("2026-09-28T14:59:59Z"))).toBe("2026-09-28");
  });
});

describe("toJstDateTimeString", () => {
  it("JSTの日時を YYYY-MM-DD HH:mm で返す", () => {
    expect(toJstDateTimeString(new Date("2026-09-28T15:05:30Z"))).toBe("2026-09-29 00:05");
  });
});

describe("withJstDate", () => {
  it("JSTの時刻を保ったまま日付を差し替える", () => {
    expect(withJstDate(new Date("2026-11-03T05:00:00Z"), "2026-11-05")).toEqual(
      new Date("2026-11-05T05:00:00Z"),
    );
  });

  it("JST0〜9時（UTCでは前日）の時刻も保つ", () => {
    expect(withJstDate(new Date("2026-11-02T23:00:00Z"), "2026-11-05")).toEqual(
      new Date("2026-11-04T23:00:00Z"),
    );
  });

  it("同じ日付なら元の日時を返す", () => {
    const date = new Date("2026-11-03T05:30:00Z");
    expect(withJstDate(date, "2026-11-03")).toEqual(date);
  });
});
