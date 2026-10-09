import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDate } from "../format-date";

describe("formatDate（ブラウザのタイムゾーンによらず日本時間）", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "America/Los_Angeles");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T16:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("当日は日本時間の時刻を表示する", () => {
    expect(formatDate("2026-11-22T15:30:00Z")).toBe("0:30");
  });

  it("24時間以内でも日本時間で前日なら「1日前」を表示する", () => {
    expect(formatDate("2026-11-22T14:00:00Z")).toBe("1日前");
  });

  it("端末の時計が遅れて未来の時刻になっても、当日として時刻を表示する", () => {
    expect(formatDate("2026-11-22T16:01:00Z")).toBe("1:01");
  });

  it("6日前までは「n日前」を表示する", () => {
    expect(formatDate("2026-11-19T15:30:00Z")).toBe("3日前");
  });

  it("7日以上前は日本時間の年/月/日を表示する", () => {
    expect(formatDate("2026-11-01T15:30:00Z")).toBe("2026/11/2");
  });
});
