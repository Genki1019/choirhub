import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isFinancePlus, EXCLUDE_HIDDEN_ROLES } from "../services/access.js";
import { toDateString, toJstDateString, toJstDateTimeString } from "../lib/date.js";
import { toCsv, csvResponse, csvFilename } from "../lib/csv.js";
import { diffChanges, mergeChanges, memberActor, recordAudit } from "../services/audit.js";
import type { TenantEnv } from "../middleware/tenant.js";

const paymentMethodSchema = z.enum(["cash", "paypay", "bank_transfer", "other"]);

const PAYMENT_METHOD_LABEL = {
  cash: "現金",
  paypay: "PayPay",
  bank_transfer: "振込",
  other: "その他",
} as const;

const PAYMENT_STATUS_LABEL = { pending: "未払い", paid: "支払済", waived: "免除" } as const;

const INVALID_YEAR_ERROR = {
  error: { code: "VALIDATION_ERROR", message: "year は4桁の数字で指定してください" },
} as const;

type DateRange = { gte?: Date; lt?: Date; lte?: Date };

function parseYear(raw: string | undefined): number | null {
  if (raw === undefined) return new Date().getFullYear();
  return /^\d{4}$/.test(raw) ? parseInt(raw, 10) : null;
}

function yearRange(year: number): DateRange {
  return { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${year + 1}-01-01T00:00:00Z`) };
}

function dateRange(from: string | undefined, to: string | undefined): DateRange {
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}

function paidAtFilter(range: DateRange) {
  return { OR: [{ paidAt: range }, { paidAt: null }] };
}

function summarizePayments(
  payments: { status: keyof typeof PAYMENT_STATUS_LABEL; amount: number | null }[],
  defaultAmount: number,
) {
  const count = (status: keyof typeof PAYMENT_STATUS_LABEL) =>
    payments.filter((p) => p.status === status).length;
  return {
    total: payments.length,
    paid: count("paid"),
    pending: count("pending"),
    waived: count("waived"),
    paidAmount: payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + (p.amount ?? defaultAmount), 0),
  };
}

// ────────────────────────────
// 支出
// ────────────────────────────

const EXPENSE_AUDIT_FIELDS = [
  "category",
  "title",
  "amount",
  "paymentMethod",
  "paidAt",
  "note",
] as const;
const COLLECTION_AUDIT_FIELDS = ["title", "amount", "dueDate", "yearMonth", "note"] as const;
const PAYMENT_AUDIT_FIELDS = ["status", "amount", "paidAt", "method", "note"] as const;
const BULK_PAYMENT_AUDIT_FIELDS = ["status", "paidAt", "method"] as const;

function expenseAuditSnapshot(e: {
  category: { name: string };
  title: string;
  amount: number;
  paymentMethod: string | null;
  paidAt: Date | null;
  note: string | null;
}) {
  return {
    category: e.category.name,
    title: e.title,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    paidAt: e.paidAt,
    note: e.note,
  };
}

const expenseBodySchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1).max(100),
  amount: z.number().int().positive(),
  paymentMethod: paymentMethodSchema.optional().nullable(),
  paidAt: z.string().date().optional().nullable(),
  eventId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// ────────────────────────────
// 徴収
// ────────────────────────────

const collectionBodySchema = z.object({
  title: z.string().min(1).max(100),
  amount: z.number().int().positive(),
  dueDate: z.string().date().optional().nullable(),
  eventId: z.string().optional().nullable(),
  scoreId: z.string().optional().nullable(),
  yearMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .nullable(),
  note: z.string().optional().nullable(),
  memberIds: z.array(z.string()).min(1).optional(),
  memberTypeAmounts: z.record(z.string(), z.number().int().positive()).optional(),
});

// ────────────────────────────
// Router
// ────────────────────────────

export const accountingRouter = new Hono<TenantEnv>()

  // ════════════════════════════════════════
  // 収支サマリー
  // ════════════════════════════════════════

  // GET /finance/summary?year=2026
  .get("/finance/summary", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const targetYear = parseYear(c.req.query("year"));
    if (targetYear === null) return c.json(INVALID_YEAR_ERROR, 400);
    const range = yearRange(targetYear);

    const [expenses, collections] = await Promise.all([
      prisma.expense.findMany({
        where: { orgId: org.id, ...paidAtFilter(range) },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { paidAt: "desc" },
      }),
      prisma.collection.findMany({
        where: { orgId: org.id, createdAt: range },
        include: {
          payments: { select: { status: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

    const totalCollected = collections.reduce((s, col) => {
      const paid = col.payments
        .filter((p) => p.status === "paid")
        .reduce((a, p) => a + (p.amount ?? col.amount), 0);
      return s + paid;
    }, 0);

    const totalPending = collections.reduce((s, col) => {
      const pending = col.payments
        .filter((p) => p.status === "pending")
        .reduce((a, p) => a + (p.amount ?? col.amount), 0);
      return s + pending;
    }, 0);

    // カテゴリ別支出
    const byCat: Record<string, { categoryId: string; name: string; total: number }> = {};
    for (const e of expenses) {
      if (!byCat[e.categoryId]) {
        byCat[e.categoryId] = { categoryId: e.categoryId, name: e.category.name, total: 0 };
      }
      byCat[e.categoryId].total += e.amount;
    }

    return c.json({
      data: {
        year: targetYear,
        totalExpense,
        totalCollected,
        totalPending,
        balance: totalCollected - totalExpense,
        expenseByCategory: Object.values(byCat),
      },
    });
  })

  // ════════════════════════════════════════
  // 支出
  // ════════════════════════════════════════

  // GET /finance/expenses
  .get("/finance/expenses", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const { from, to, categoryId } = c.req.query();

    const expenses = await prisma.expense.findMany({
      where: {
        orgId: org.id,
        ...(from || to ? paidAtFilter(dateRange(from, to)) : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { paidAt: { sort: "desc", nulls: "last" } },
    });

    return c.json({
      data: expenses.map((e) => ({
        id: e.id,
        category: { id: e.category.id, name: e.category.name },
        title: e.title,
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        paidAt: e.paidAt?.toISOString() ?? null,
        eventId: e.eventId,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  })

  // GET /finance/expenses/export
  .get("/finance/expenses/export", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const year = parseYear(c.req.query("year"));
    if (year === null) return c.json(INVALID_YEAR_ERROR, 400);

    const expenses = await prisma.expense.findMany({
      where: { orgId: org.id, ...paidAtFilter(yearRange(year)) },
      include: {
        category: { select: { name: true } },
        event: { select: { title: true } },
      },
      orderBy: [{ paidAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });

    const csv = toCsv(
      ["支払日", "カテゴリ", "件名", "金額", "支払方法", "関連イベント", "メモ", "登録日時"],
      expenses.map((e) => [
        e.paidAt ? toDateString(e.paidAt) : null,
        e.category.name,
        e.title,
        e.amount,
        e.paymentMethod ? PAYMENT_METHOD_LABEL[e.paymentMethod] : null,
        e.event?.title,
        e.note,
        toJstDateTimeString(e.createdAt),
      ]),
    );
    await recordAudit(prisma, org.id, memberActor(c), {
      action: "expenses.exported",
      targetType: "expenses",
      targetLabel: `支出（${year}年・${expenses.length}件）`,
    });
    return csvResponse(c, csvFilename(`expenses_${year}`), csv);
  })

  // POST /finance/expenses
  .post(
    "/finance/expenses",
    zValidator("json", expenseBodySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const body = c.req.valid("json");

      const cat = await prisma.expenseCategory.findUnique({ where: { id: body.categoryId } });
      if (!cat || cat.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "カテゴリが見つかりません" } }, 404);
      }
      if (body.eventId) {
        const ev = await prisma.event.findUnique({ where: { id: body.eventId } });
        if (!ev || ev.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
        }
      }

      const actor = memberActor(c);
      const expense = await prisma.$transaction(async (tx) => {
        const created = await tx.expense.create({
          data: {
            orgId: org.id,
            categoryId: body.categoryId,
            title: body.title,
            amount: body.amount,
            paymentMethod: body.paymentMethod ?? null,
            paidAt: body.paidAt ? new Date(body.paidAt) : null,
            eventId: body.eventId ?? null,
            note: body.note ?? null,
            recordedById: member.id,
          },
          include: { category: { select: { id: true, name: true } } },
        });
        await recordAudit(tx, org.id, actor, {
          action: "expense.created",
          targetType: "expense",
          targetId: created.id,
          targetLabel: created.title,
          changes: diffChanges(null, expenseAuditSnapshot(created), EXPENSE_AUDIT_FIELDS),
        });
        return created;
      });

      return c.json(
        {
          data: {
            id: expense.id,
            category: { id: expense.category.id, name: expense.category.name },
            title: expense.title,
            amount: expense.amount,
            paymentMethod: expense.paymentMethod,
            paidAt: expense.paidAt?.toISOString() ?? null,
            eventId: expense.eventId,
            note: expense.note,
            createdAt: expense.createdAt.toISOString(),
          },
        },
        201,
      );
    },
  )

  // PATCH /finance/expenses/:expenseId
  .patch(
    "/finance/expenses/:expenseId",
    zValidator("json", expenseBodySchema.partial(), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { expenseId } = c.req.param();

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const target = await prisma.expense.findFirst({
        where: { id: expenseId, orgId: org.id },
        include: { category: { select: { name: true } } },
      });
      if (!target) {
        return c.json({ error: { code: "NOT_FOUND", message: "支出が見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      if (body.categoryId !== undefined) {
        const cat = await prisma.expenseCategory.findUnique({ where: { id: body.categoryId } });
        if (!cat || cat.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "カテゴリが見つかりません" } }, 404);
        }
      }
      if (body.eventId) {
        const ev = await prisma.event.findUnique({ where: { id: body.eventId } });
        if (!ev || ev.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
        }
      }

      const actor = memberActor(c);
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.expense.update({
          where: { id: expenseId, orgId: org.id },
          data: {
            ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
            ...(body.title !== undefined && { title: body.title }),
            ...(body.amount !== undefined && { amount: body.amount }),
            ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
            ...(body.paidAt !== undefined && {
              paidAt: body.paidAt ? new Date(body.paidAt) : null,
            }),
            ...(body.eventId !== undefined && { eventId: body.eventId }),
            ...(body.note !== undefined && { note: body.note }),
          },
          include: { category: { select: { id: true, name: true } } },
        });
        const changes = diffChanges(
          expenseAuditSnapshot(target),
          expenseAuditSnapshot(result),
          EXPENSE_AUDIT_FIELDS,
        );
        if (changes) {
          await recordAudit(tx, org.id, actor, {
            action: "expense.updated",
            targetType: "expense",
            targetId: result.id,
            targetLabel: result.title,
            changes,
          });
        }
        return result;
      });

      return c.json({
        data: {
          id: updated.id,
          category: { id: updated.category.id, name: updated.category.name },
          title: updated.title,
          amount: updated.amount,
          paymentMethod: updated.paymentMethod,
          paidAt: updated.paidAt?.toISOString() ?? null,
          eventId: updated.eventId,
          note: updated.note,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    },
  )

  // DELETE /finance/expenses/:expenseId
  .delete("/finance/expenses/:expenseId", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { expenseId } = c.req.param();

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const target = await prisma.expense.findFirst({
      where: { id: expenseId, orgId: org.id },
      include: { category: { select: { name: true } } },
    });
    if (!target) {
      return c.json({ error: { code: "NOT_FOUND", message: "支出が見つかりません" } }, 404);
    }

    await prisma.$transaction([
      prisma.expense.delete({ where: { id: expenseId, orgId: org.id } }),
      recordAudit(prisma, org.id, memberActor(c), {
        action: "expense.deleted",
        targetType: "expense",
        targetId: target.id,
        targetLabel: target.title,
        changes: diffChanges(expenseAuditSnapshot(target), null, EXPENSE_AUDIT_FIELDS),
      }),
    ]);
    return new Response(null, { status: 204 });
  })

  // ════════════════════════════════════════
  // 徴収
  // ════════════════════════════════════════

  // GET /finance/collections
  .get("/finance/collections", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const { from, to } = c.req.query();

    const collections = await prisma.collection.findMany({
      where: { orgId: org.id, ...(from || to ? { createdAt: dateRange(from, to) } : {}) },
      include: {
        payments: { select: { status: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      data: collections.map((col) => ({
        id: col.id,
        title: col.title,
        amount: col.amount,
        dueDate: col.dueDate?.toISOString() ?? null,
        eventId: col.eventId,
        yearMonth: col.yearMonth,
        note: col.note,
        createdAt: col.createdAt.toISOString(),
        summary: summarizePayments(col.payments, col.amount),
      })),
    });
  })

  // POST /finance/collections
  .post(
    "/finance/collections",
    zValidator("json", collectionBodySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const body = c.req.valid("json");

      if (body.eventId) {
        const ev = await prisma.event.findUnique({ where: { id: body.eventId } });
        if (!ev || ev.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
        }
      }
      if (body.scoreId) {
        const score = await prisma.score.findUnique({ where: { id: body.scoreId } });
        if (!score || score.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
        }
      }

      const targets = body.memberIds
        ? await prisma.member.findMany({
            where: { id: { in: body.memberIds }, orgId: org.id },
            include: { memberType: true },
          })
        : await prisma.member.findMany({
            where: { orgId: org.id, status: "active", ...EXCLUDE_HIDDEN_ROLES },
            include: { memberType: true },
          });

      const individualAmount = (m: (typeof targets)[number]): number | null => {
        if (!body.memberTypeAmounts || !m.memberTypeId) return null;
        const typeAmount = body.memberTypeAmounts[m.memberTypeId];
        return typeAmount !== undefined && typeAmount !== body.amount ? typeAmount : null;
      };

      const actor = memberActor(c);
      const col = await prisma.$transaction(async (tx) => {
        const created = await tx.collection.create({
          data: {
            orgId: org.id,
            title: body.title,
            amount: body.amount,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            eventId: body.eventId ?? null,
            scoreId: body.scoreId ?? null,
            yearMonth: body.yearMonth ?? null,
            note: body.note ?? null,
            createdById: member.id,
          },
        });
        await tx.collectionPayment.createMany({
          data: targets.map((m) => ({
            collectionId: created.id,
            memberId: m.id,
            status: "pending" as const,
            amount: individualAmount(m),
          })),
        });
        await recordAudit(tx, org.id, actor, {
          action: "collection.created",
          targetType: "collection",
          targetId: created.id,
          targetLabel: created.title,
          changes: {
            ...diffChanges(null, created, COLLECTION_AUDIT_FIELDS),
            members: { before: null, after: targets.length },
          },
        });
        return created;
      });

      return c.json({ data: { id: col.id, title: col.title, amount: col.amount } }, 201);
    },
  )

  // GET /finance/collections/export
  .get("/finance/collections/export", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const year = parseYear(c.req.query("year"));
    if (year === null) return c.json(INVALID_YEAR_ERROR, 400);

    const collections = await prisma.collection.findMany({
      where: { orgId: org.id, createdAt: yearRange(year) },
      include: { payments: { select: { status: true, amount: true } } },
      orderBy: { createdAt: "asc" },
    });

    const csv = toCsv(
      [
        "作成日",
        "徴収名",
        "対象年月",
        "締切日",
        "金額",
        "対象人数",
        "支払済",
        "未払い",
        "免除",
        "支払済額",
        "メモ",
      ],
      collections.map((col) => {
        const summary = summarizePayments(col.payments, col.amount);
        return [
          toJstDateString(col.createdAt),
          col.title,
          col.yearMonth,
          col.dueDate ? toDateString(col.dueDate) : null,
          col.amount,
          summary.total,
          summary.paid,
          summary.pending,
          summary.waived,
          summary.paidAmount,
          col.note,
        ];
      }),
    );
    await recordAudit(prisma, org.id, memberActor(c), {
      action: "collections.exported",
      targetType: "collections",
      targetLabel: `徴収（${year}年・${collections.length}件）`,
    });
    return csvResponse(c, csvFilename(`collections_${year}`), csv);
  })

  // GET /finance/payments/export
  .get("/finance/payments/export", async (c) => {
    const org = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const year = parseYear(c.req.query("year"));
    if (year === null) return c.json(INVALID_YEAR_ERROR, 400);

    const payments = await prisma.collectionPayment.findMany({
      where: { collection: { orgId: org.id, createdAt: yearRange(year) } },
      include: {
        collection: { select: { title: true, yearMonth: true, dueDate: true, amount: true } },
        member: {
          include: {
            userRef: { select: { nameJa: true } },
            part: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { collection: { createdAt: "asc" } },
        { member: { part: { sortOrder: "asc" } } },
        { member: { userRef: { nameKana: "asc" } } },
      ],
    });

    const csv = toCsv(
      [
        "徴収名",
        "対象年月",
        "締切日",
        "氏名",
        "パート",
        "状態",
        "金額",
        "支払日",
        "支払方法",
        "メモ",
      ],
      payments.map((p) => [
        p.collection.title,
        p.collection.yearMonth,
        p.collection.dueDate ? toDateString(p.collection.dueDate) : null,
        p.member.userRef.nameJa,
        p.member.part?.name,
        PAYMENT_STATUS_LABEL[p.status],
        p.amount ?? p.collection.amount,
        p.paidAt ? toDateString(p.paidAt) : null,
        p.method ? PAYMENT_METHOD_LABEL[p.method] : null,
        p.note,
      ]),
    );
    await recordAudit(prisma, org.id, memberActor(c), {
      action: "payments.exported",
      targetType: "payments",
      targetLabel: `支払い記録（${year}年・${payments.length}件）`,
    });
    return csvResponse(c, csvFilename(`collection_payments_${year}`), csv);
  })

  // GET /finance/collections/:collectionId
  .get("/finance/collections/:collectionId", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { collectionId } = c.req.param();

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const col = await prisma.collection.findFirst({
      where: { id: collectionId, orgId: org.id },
      include: {
        payments: {
          include: {
            member: {
              include: {
                userRef: { select: { nameJa: true } },
                part: { select: { id: true, name: true, voiceType: true, sortOrder: true } },
                memberType: { select: { defaultFeeAmount: true } },
              },
            },
          },
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!col) {
      return c.json({ error: { code: "NOT_FOUND", message: "徴収が見つかりません" } }, 404);
    }

    return c.json({
      data: {
        id: col.id,
        title: col.title,
        amount: col.amount,
        dueDate: col.dueDate?.toISOString() ?? null,
        eventId: col.eventId,
        yearMonth: col.yearMonth,
        note: col.note,
        createdAt: col.createdAt.toISOString(),
        payments: col.payments.map((p) => ({
          id: p.id,
          member: {
            id: p.member.id,
            nameJa: p.member.userRef.nameJa,
            part: p.member.part
              ? {
                  id: p.member.part.id,
                  name: p.member.part.name,
                  voiceType: p.member.part.voiceType,
                  sortOrder: p.member.part.sortOrder,
                }
              : null,
            memberTypeFee: p.member.memberType?.defaultFeeAmount ?? null,
          },
          status: p.status,
          amount: p.amount,
          paidAt: p.paidAt?.toISOString() ?? null,
          method: p.method,
          note: p.note,
        })),
      },
    });
  })

  // PATCH /finance/collections/:collectionId
  .patch(
    "/finance/collections/:collectionId",
    zValidator(
      "json",
      collectionBodySchema.omit({ memberIds: true, scoreId: true }).partial(),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { collectionId } = c.req.param();

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const target = await prisma.collection.findFirst({
        where: { id: collectionId, orgId: org.id },
      });
      if (!target) {
        return c.json({ error: { code: "NOT_FOUND", message: "徴収が見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      if (body.eventId) {
        const ev = await prisma.event.findUnique({ where: { id: body.eventId } });
        if (!ev || ev.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
        }
      }

      const actor = memberActor(c);
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.collection.update({
          where: { id: collectionId, orgId: org.id },
          data: {
            ...(body.title !== undefined && { title: body.title }),
            ...(body.amount !== undefined && { amount: body.amount }),
            ...(body.dueDate !== undefined && {
              dueDate: body.dueDate ? new Date(body.dueDate) : null,
            }),
            ...(body.eventId !== undefined && { eventId: body.eventId }),
            ...(body.yearMonth !== undefined && { yearMonth: body.yearMonth }),
            ...(body.note !== undefined && { note: body.note }),
          },
        });
        const changes = diffChanges(target, result, COLLECTION_AUDIT_FIELDS);
        if (changes) {
          await recordAudit(tx, org.id, actor, {
            action: "collection.updated",
            targetType: "collection",
            targetId: result.id,
            targetLabel: result.title,
            changes,
          });
        }
        return result;
      });

      return c.json({ data: { id: updated.id, title: updated.title, amount: updated.amount } });
    },
  )

  // DELETE /finance/collections/:collectionId
  .delete("/finance/collections/:collectionId", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { collectionId } = c.req.param();

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const target = await prisma.collection.findFirst({
      where: { id: collectionId, orgId: org.id },
      include: { _count: { select: { payments: true } } },
    });
    if (!target) {
      return c.json({ error: { code: "NOT_FOUND", message: "徴収が見つかりません" } }, 404);
    }

    await prisma.$transaction([
      prisma.collection.delete({ where: { id: collectionId, orgId: org.id } }),
      recordAudit(prisma, org.id, memberActor(c), {
        action: "collection.deleted",
        targetType: "collection",
        targetId: target.id,
        targetLabel: target.title,
        changes: {
          ...diffChanges(target, null, COLLECTION_AUDIT_FIELDS),
          members: { before: target._count.payments, after: null },
        },
      }),
    ]);
    return new Response(null, { status: 204 });
  })

  // ════════════════════════════════════════
  // 支払い記録（個人単位）
  // ════════════════════════════════════════

  // PATCH /finance/collections/:collectionId/payments/:memberId
  .patch(
    "/finance/collections/:collectionId/payments/:memberId",
    zValidator(
      "json",
      z.object({
        status: z.enum(["pending", "paid", "waived"]),
        amount: z.number().int().positive().optional().nullable(),
        paidAt: z.string().date().optional().nullable(),
        method: paymentMethodSchema.optional().nullable(),
        note: z.string().optional().nullable(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { collectionId, memberId } = c.req.param();

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const col = await prisma.collection.findUnique({ where: { id: collectionId } });
      if (!col || col.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "徴収が見つかりません" } }, 404);
      }

      // memberId がこの org に所属するか確認（クロステナント防止）
      const targetMember = await prisma.member.findUnique({
        where: { id: memberId },
        select: { orgId: true, userRef: { select: { nameJa: true } } },
      });
      if (!targetMember || targetMember.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      const actor = memberActor(c);
      const payment = await prisma.$transaction(async (tx) => {
        const before = await tx.collectionPayment.findUnique({
          where: { collectionId_memberId: { collectionId, memberId } },
        });
        const result = await tx.collectionPayment.upsert({
          where: { collectionId_memberId: { collectionId, memberId } },
          create: {
            collectionId,
            memberId,
            status: body.status,
            amount: body.amount ?? null,
            paidAt: body.paidAt ? new Date(body.paidAt) : null,
            method: body.method ?? null,
            note: body.note ?? null,
            recordedById: member.id,
          },
          update: {
            status: body.status,
            amount: body.amount ?? null,
            paidAt: body.paidAt ? new Date(body.paidAt) : null,
            method: body.method ?? null,
            note: body.note ?? null,
            recordedById: member.id,
          },
        });
        const changes = diffChanges(before, result, PAYMENT_AUDIT_FIELDS);
        if (changes) {
          await recordAudit(tx, org.id, actor, {
            action: "payment.changed",
            targetType: "collection",
            targetId: collectionId,
            targetLabel: `${col.title} / ${targetMember.userRef.nameJa}`,
            changes,
          });
        }
        return result;
      });

      return c.json({
        data: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          paidAt: payment.paidAt?.toISOString() ?? null,
          method: payment.method,
          note: payment.note,
        },
      });
    },
  )

  // POST /finance/collections/:collectionId/payments/bulk
  // 複数メンバーの支払い状態を一括更新
  .post(
    "/finance/collections/:collectionId/payments/bulk",
    zValidator(
      "json",
      z.object({
        memberIds: z.array(z.string()).min(1),
        status: z.enum(["pending", "paid", "waived"]),
        paidAt: z.string().date().optional().nullable(),
        method: paymentMethodSchema.optional().nullable(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { collectionId } = c.req.param();

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const col = await prisma.collection.findUnique({ where: { id: collectionId } });
      if (!col || col.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "徴収が見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      // 全 memberId がこの org に属するか確認（クロステナント更新防止）
      const validMembers = await prisma.member.findMany({
        where: { id: { in: body.memberIds }, orgId: org.id },
        select: { id: true, userRef: { select: { nameJa: true } } },
      });
      if (validMembers.length !== body.memberIds.length) {
        return c.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "このテナントに存在しないメンバーIDが含まれています",
            },
          },
          400,
        );
      }

      const next = {
        status: body.status,
        paidAt: body.paidAt ? new Date(body.paidAt) : null,
        method: body.method ?? null,
      };
      const actor = memberActor(c);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.collectionPayment.findMany({
          where: { collectionId, memberId: { in: body.memberIds } },
          select: { memberId: true, status: true, paidAt: true, method: true },
        });
        const beforeById = new Map(existing.map((p) => [p.memberId, p]));
        const changed = validMembers.flatMap((m) => {
          const diff = diffChanges(beforeById.get(m.id) ?? null, next, BULK_PAYMENT_AUDIT_FIELDS);
          return diff ? [{ name: m.userRef.nameJa, diff }] : [];
        });

        for (const mid of body.memberIds) {
          await tx.collectionPayment.upsert({
            where: { collectionId_memberId: { collectionId, memberId: mid } },
            create: { collectionId, memberId: mid, ...next, recordedById: member.id },
            update: { ...next, recordedById: member.id },
          });
        }

        if (changed.length > 0) {
          await recordAudit(tx, org.id, actor, {
            action: "payment.changed",
            targetType: "collection",
            targetId: collectionId,
            targetLabel: `${col.title}（${changed.length}名一括）`,
            changes: {
              ...mergeChanges(changed.map((x) => x.diff)),
              members: { before: null, after: changed.map((x) => x.name) },
            },
          });
        }
      });

      return c.json({ data: { updated: body.memberIds.length } });
    },
  );
