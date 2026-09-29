import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
vi.mock("../../lib/prisma.js", () => ({ prisma: {} }));

import {
  auditRetentionCutoff,
  diffChanges,
  memberActor,
  mergeChanges,
  recordAudit,
  systemAdminActor,
} from "../audit.js";
import type { TenantEnv } from "../../middleware/tenant.js";
import type { AuthEnv } from "../../middleware/auth.js";
import type { Member, Organization } from "../../generated/prisma/index.js";

describe("diffChanges", () => {
  it("変更されたフィールドだけを before/after で返す", () => {
    const before: { title: string; amount: number; note: string | null } = {
      title: "会場費",
      amount: 8000,
      note: null,
    };
    const after = { title: "会場費", amount: 9000, note: "追加" };
    expect(diffChanges(before, after, ["title", "amount", "note"])).toEqual({
      amount: { before: 8000, after: 9000 },
      note: { before: null, after: "追加" },
    });
  });

  it("変更がなければ null を返す", () => {
    const value = { roles: ["member", "tech"] };
    expect(diffChanges(value, { roles: ["member", "tech"] }, ["roles"])).toBeNull();
  });

  it("作成（before なし）・削除（after なし）では null 以外の値だけを差分にする", () => {
    const record = { title: "会場費", note: null };
    expect(diffChanges(null, record, ["title", "note"])).toEqual({
      title: { before: null, after: "会場費" },
    });
    expect(diffChanges(record, null, ["title", "note"])).toEqual({
      title: { before: "会場費", after: null },
    });
  });

  it("Date は YYYY-MM-DD に変換して比較する", () => {
    expect(
      diffChanges(
        { paidAt: new Date("2026-06-01T00:00:00Z") },
        { paidAt: new Date("2026-06-02T00:00:00Z") },
        ["paidAt"],
      ),
    ).toEqual({ paidAt: { before: "2026-06-01", after: "2026-06-02" } });
  });
});

describe("recordAudit", () => {
  it("操作者・対象・差分を1行として書き込む", async () => {
    const create = vi.fn().mockResolvedValue({});
    const actor = {
      actorType: "member" as const,
      actorMemberId: "member-1",
      actorName: "山田 太郎",
      ipAddress: "203.0.113.1",
      userAgent: "test-agent",
    };

    await recordAudit({ auditLog: { create } } as never, "org-1", actor, {
      action: "expense.deleted",
      targetType: "expense",
      targetId: "expense-1",
      targetLabel: "会場費",
      changes: { amount: { before: 8000, after: null } },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        orgId: "org-1",
        ...actor,
        action: "expense.deleted",
        targetType: "expense",
        targetId: "expense-1",
        targetLabel: "会場費",
        changes: { amount: { before: 8000, after: null } },
      },
    });
  });
});

describe("memberActor / systemAdminActor", () => {
  const user = { id: "user-1", nameJa: "山田 太郎", email: "a@example.com", avatarUrl: null };

  it("団員の操作は memberId・氏名・IPアドレス・User-Agent を持つ", async () => {
    const app = new Hono<TenantEnv>();
    app.get("/", (c) => {
      c.set("user", user);
      c.set("org", { id: "org-1", slug: "tokyo-men-choir" } as Organization);
      c.set("member", { id: "member-1" } as Member);
      return c.json(memberActor(c));
    });
    const res = await app.request("/", {
      headers: { "x-vercel-forwarded-for": "203.0.113.1", "user-agent": "test-agent" },
    });
    expect(await res.json()).toEqual({
      actorType: "member",
      actorMemberId: "member-1",
      actorName: "山田 太郎",
      ipAddress: "203.0.113.1",
      userAgent: "test-agent",
    });
  });

  it("公開デモ団体（PROTECTED_ORG_SLUGS）では IPアドレス・User-Agent を記録しない", async () => {
    process.env.PROTECTED_ORG_SLUGS = "harmonia";
    const app = new Hono<TenantEnv>();
    app.get("/", (c) => {
      c.set("user", user);
      c.set("org", { id: "org-1", slug: "harmonia" } as Organization);
      c.set("member", { id: "member-1" } as Member);
      return c.json(memberActor(c));
    });
    const res = await app.request("/", {
      headers: { "x-vercel-forwarded-for": "203.0.113.1", "user-agent": "test-agent" },
    });
    delete process.env.PROTECTED_ORG_SLUGS;

    expect(await res.json()).toMatchObject({
      actorMemberId: "member-1",
      ipAddress: null,
      userAgent: null,
    });
  });

  it("システム管理者の操作は memberId を持たず、氏名にシステム管理者と付記する", async () => {
    const app = new Hono<AuthEnv>();
    app.get("/", (c) => {
      c.set("user", user);
      return c.json(systemAdminActor(c));
    });
    const res = await app.request("/");
    expect(await res.json()).toMatchObject({
      actorType: "system_admin",
      actorMemberId: null,
      actorName: "山田 太郎（システム管理者）",
      userAgent: null,
    });
  });
});

describe("mergeChanges", () => {
  it("変更前の値は重複を除いて並べ、1種類ならその値にする", () => {
    expect(
      mergeChanges([
        { status: { before: "pending", after: "paid" }, method: { before: null, after: "cash" } },
        { status: { before: "waived", after: "paid" }, method: { before: null, after: "cash" } },
        { status: { before: "pending", after: "paid" } },
      ]),
    ).toEqual({
      status: { before: ["pending", "waived"], after: "paid" },
      method: { before: null, after: "cash" },
    });
  });

  it("差分がなければ null を返す", () => {
    expect(mergeChanges([])).toBeNull();
  });
});

describe("auditRetentionCutoff", () => {
  it("うるう年をまたいでも日数ではなく暦の2年前を返す", () => {
    expect(auditRetentionCutoff(new Date("2028-09-29T12:00:00Z"))).toEqual(
      new Date("2026-09-29T12:00:00Z"),
    );
  });

  it("2月29日は2年前に同日がないため翌日（3月1日）とし、保存期間を短くしない", () => {
    expect(auditRetentionCutoff(new Date("2028-02-29T00:00:00Z"))).toEqual(
      new Date("2026-03-01T00:00:00Z"),
    );
  });
});
