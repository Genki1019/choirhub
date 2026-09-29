import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditLogItem } from "../AuditLogItem";
import type { AuditLogItem as AuditLog } from "@/lib/audit-logs-api";

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "log-1",
    createdAt: "2026-09-01T01:00:00.000Z",
    actorType: "member",
    actorMemberId: "member-1",
    actorName: "鈴木 一郎",
    action: "expense.deleted",
    category: "finance",
    targetType: "expense",
    targetId: "expense-1",
    targetLabel: "会場費",
    changes: {
      amount: { before: 8000, after: null },
      paymentMethod: { before: "bank_transfer", after: null },
    },
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

function renderItem(log: AuditLog) {
  return render(
    <ul>
      <AuditLogItem log={log} />
    </ul>,
  );
}

describe("AuditLogItem", () => {
  it("操作・対象・操作者を表示し、IPアドレスがなければ表示しない", () => {
    renderItem(makeLog());

    expect(screen.getByText("支出削除")).toBeInTheDocument();
    expect(screen.getByText("会場費")).toHaveAttribute("title", "会場費");
    expect(screen.getByText(/鈴木 一郎$/)).toBeInTheDocument();
  });

  it("展開すると削除前の値を項目名付きで表示し、再度押すと閉じる", async () => {
    renderItem(makeLog());
    const toggle = screen.getByRole("button");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("金額")).toBeInTheDocument();
    expect(screen.getByText("¥8,000")).toBeInTheDocument();
    expect(screen.getByText("振込")).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.queryByText("金額")).not.toBeInTheDocument();
  });

  it("差分もUser-Agentもない記録は展開できない", () => {
    renderItem(
      makeLog({
        action: "members.exported",
        category: "export",
        targetLabel: "名簿（38名）",
        changes: null,
      }),
    );

    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-expanded");
  });

  it("システム管理者による操作は操作者名に付記された名前で表示する", () => {
    renderItem(
      makeLog({
        actorType: "system_admin",
        actorMemberId: null,
        actorName: "運営 太郎（システム管理者）",
        action: "org.restored",
        category: "org",
        changes: null,
      }),
    );

    expect(screen.getByText(/運営 太郎（システム管理者）/)).toBeInTheDocument();
  });
});
