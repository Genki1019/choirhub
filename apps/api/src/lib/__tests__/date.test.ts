import { describe, it, expect } from "vitest";
import { toDateString, toJstDateString, toJstDateTimeString } from "../date.js";

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
