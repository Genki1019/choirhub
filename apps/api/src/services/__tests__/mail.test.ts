import { describe, it, expect } from "vitest";
import { resolveInviteRecipient } from "../mail.js";

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
