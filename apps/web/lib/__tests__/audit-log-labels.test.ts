import { describe, it, expect } from "vitest";
import { auditFieldLabel, formatAuditValue } from "../audit-log-labels";

describe("formatAuditValue", () => {
  it("null・空文字は「—」で表示する", () => {
    expect(formatAuditValue("expense.updated", "note", null)).toBe("—");
    expect(formatAuditValue("expense.updated", "note", "")).toBe("—");
  });

  it("ロールは日本語名で読点区切りにする", () => {
    expect(formatAuditValue("member.roles_changed", "roles", ["admin", "finance"])).toBe(
      "最高管理者、会計",
    );
  });

  it("金額は円表記、対象者数は人数表記にする", () => {
    expect(formatAuditValue("expense.updated", "amount", 12000)).toBe("¥12,000");
    expect(formatAuditValue("collection.deleted", "members", 12)).toBe("12名");
  });

  it("対象者の氏名リストは読点区切りにする", () => {
    expect(formatAuditValue("payment.changed", "members", ["佐藤 花子", "鈴木 一郎"])).toBe(
      "佐藤 花子、鈴木 一郎",
    );
  });

  it("状態は操作の種類に応じて在団状態・支払い状態のラベルにする", () => {
    expect(formatAuditValue("member.status_changed", "status", "offstage")).toBe("休団");
    expect(formatAuditValue("payment.changed", "status", "paid")).toBe("支払済");
  });

  it("一括更新で変更前の状態が複数ある場合は、それぞれをラベルにして並べる", () => {
    expect(formatAuditValue("payment.changed", "status", ["pending", "waived"])).toBe(
      "未払い、免除",
    );
  });

  it("支払方法は日本語ラベルにする", () => {
    expect(formatAuditValue("expense.created", "paymentMethod", "bank_transfer")).toBe("振込");
    expect(formatAuditValue("payment.changed", "method", "cash")).toBe("現金");
  });
});

describe("auditFieldLabel", () => {
  it("既知のフィールドは日本語名、未知のフィールドはそのまま返す", () => {
    expect(auditFieldLabel("paidAt")).toBe("支払日");
    expect(auditFieldLabel("unknown")).toBe("unknown");
  });
});
