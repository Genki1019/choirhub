import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveInviteRecipient,
  sendEmailChangeConfirmationEmail,
  sendEmailChangedNotification,
  sendInviteEmail,
  sendOrgDeletedEmail,
  sendPasswordResetEmail,
} from "../mail.js";
import { logger } from "../../lib/logger.js";

describe("resolveInviteRecipient", () => {
  it("既存ユーザー: isExistingUserがtrue、nameJaは既存ユーザーの表示名を優先する", () => {
    const result = resolveInviteRecipient({ nameJa: "既存 太郎" }, "フォールバック 花子");

    expect(result).toEqual({ nameJa: "既存 太郎", isExistingUser: true });
  });

  it("新規ユーザー: isExistingUserがfalse、nameJaはフォールバック値を使う", () => {
    const result = resolveInviteRecipient(null, "新規 花子");

    expect(result).toEqual({ nameJa: "新規 花子", isExistingUser: false });
  });

  it("新規ユーザーでフォールバック値も未指定: nameJaはnullになる", () => {
    const result = resolveInviteRecipient(null);

    expect(result).toEqual({ nameJa: null, isExistingUser: false });
  });

  it("新規ユーザーでフォールバック値がnull: nameJaはnullになる", () => {
    const result = resolveInviteRecipient(null, null);

    expect(result).toEqual({ nameJa: null, isExistingUser: false });
  });
});

describe("sendOrgDeletedEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("件名に団体名、本文に操作者・日本時間の削除日・完全削除予定日を含めて全宛先へ送る", async () => {
    // RESEND_API_KEY未設定時はコンソール（logger）へフォールバックするため、その出力で内容を検証する
    const info = vi.spyOn(logger, "info").mockImplementation(() => {});

    await sendOrgDeletedEmail({
      to: [{ email: "a@example.com" }, { email: "b@example.com" }],
      orgName: "東京男声合唱団",
      deletedByName: "山田 太郎",
      deletedAt: new Date("2026-09-23T23:00:00Z"),
      purgeScheduledAt: new Date("2026-10-23T23:00:00Z"),
    });

    const output = info.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("【ChoirHub】東京男声合唱団 は削除されました");
    expect(output).toContain("a@example.com, b@example.com");
    expect(output).toContain("2026年9月24日、山田 太郎さんの操作により「東京男声合唱団」");
    expect(output).toContain("2026年10月24日に、団体のすべてのデータ");
  });
});

describe("メールの日時（サーバーのタイムゾーンによらず日本時間）", () => {
  const expiresAt = new Date("2026-10-31T17:30:00Z");

  function capture() {
    vi.stubEnv("TZ", "UTC");
    const info = vi.spyOn(logger, "info").mockImplementation(() => {});
    return () => info.mock.calls.map((call) => call[0]).join("\n");
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("招待メールは日本時間の日付で表示する", async () => {
    const output = capture();
    await sendInviteEmail({
      to: "a@example.com",
      nameJa: null,
      orgName: "東京男声合唱団",
      inviteToken: "token",
      expiresAt,
      isExistingUser: false,
    });

    expect(output()).toContain("有効期限 : 2026年11月1日");
  });

  it("パスワード再設定メールは日本時間の日時で表示する", async () => {
    const output = capture();
    await sendPasswordResetEmail({
      to: "a@example.com",
      nameJa: "山田",
      resetToken: "t",
      expiresAt,
    });

    expect(output()).toContain("2026年11月1日 02:30");
  });

  it("メールアドレス変更の確認メールは日本時間の日時で表示する", async () => {
    const output = capture();
    await sendEmailChangeConfirmationEmail({
      to: "a@example.com",
      nameJa: "山田",
      confirmToken: "t",
      expiresAt,
    });

    expect(output()).toContain("2026年11月1日 02:30");
  });

  it("メールアドレス変更の通知は変更日時を日本時間で表示する", async () => {
    const output = capture();
    await sendEmailChangedNotification({
      to: "a@example.com",
      nameJa: "山田",
      newEmail: "b@example.com",
      changedAt: expiresAt,
    });

    expect(output()).toContain("2026年11月1日 02:30");
  });
});
