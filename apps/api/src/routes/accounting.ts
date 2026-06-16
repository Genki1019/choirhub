import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isFinancePlus } from "../services/access.js";
import type { TenantEnv } from "../middleware/tenant.js";

const paymentMethodSchema = z.enum(["cash", "paypay", "bank_transfer", "other"]);

// ────────────────────────────
// 支出
// ────────────────────────────

const expenseBodySchema = z.object({
  categoryId:    z.string().min(1),
  title:         z.string().min(1).max(100),
  amount:        z.number().int().positive(),
  paymentMethod: paymentMethodSchema.optional().nullable(),
  paidAt:        z.string().date().optional().nullable(),
  eventId:       z.string().optional().nullable(),
  note:          z.string().optional().nullable(),
});

// ────────────────────────────
// 徴収
// ────────────────────────────

const collectionBodySchema = z.object({
  title:     z.string().min(1).max(100),
  amount:    z.number().int().positive(),
  dueDate:   z.string().date().optional().nullable(),
  eventId:   z.string().optional().nullable(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  note:      z.string().optional().nullable(),
  memberIds: z.array(z.string()).min(1).optional(),
});

// ────────────────────────────
// Router
// ────────────────────────────

export const accountingRouter = new Hono<TenantEnv>()

  // ════════════════════════════════════════
  // 収支サマリー
  // ════════════════════════════════════════

  // GET /finance/summary?year=2026
  .get("/accounting/summary", async (c) => {
    const org    = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const yearRaw = c.req.query("year");
    if (yearRaw !== undefined && !/^\d{4}$/.test(yearRaw)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "year は4桁の数字で指定してください" } }, 400);
    }
    const targetYear = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear();

    const since = new Date(`${targetYear}-01-01T00:00:00Z`);
    const until = new Date(`${targetYear + 1}-01-01T00:00:00Z`);

    const [expenses, collections] = await Promise.all([
      prisma.expense.findMany({
        where: { orgId: org.id, OR: [{ paidAt: { gte: since, lt: until } }, { paidAt: null }] },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { paidAt: "desc" },
      }),
      prisma.collection.findMany({
        where: { orgId: org.id, createdAt: { gte: since, lt: until } },
        include: {
          payments: { select: { status: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

    const totalCollected = collections.reduce((s, col) => {
      const paid = col.payments.filter((p) => p.status === "paid").reduce((a, p) => a + (p.amount ?? col.amount), 0);
      return s + paid;
    }, 0);

    const totalPending = collections.reduce((s, col) => {
      const pending = col.payments.filter((p) => p.status === "pending").reduce((a, p) => a + (p.amount ?? col.amount), 0);
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
  .get("/accounting/expenses", async (c) => {
    const org    = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const { from, to, categoryId } = c.req.query();

    const paidAtFilter = (from || to)
      ? {
          OR: [
            {
              paidAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to   ? { lte: new Date(to)   } : {}),
              },
            },
            { paidAt: null },
          ],
        }
      : {};

    const expenses = await prisma.expense.findMany({
      where: {
        orgId: org.id,
        ...paidAtFilter,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { paidAt: { sort: "desc", nulls: "last" } },
    });

    return c.json({
      data: expenses.map((e) => ({
        id:            e.id,
        category:      { id: e.category.id, name: e.category.name },
        title:         e.title,
        amount:        e.amount,
        paymentMethod: e.paymentMethod,
        paidAt:        e.paidAt?.toISOString() ?? null,
        eventId:       e.eventId,
        note:          e.note,
        createdAt:     e.createdAt.toISOString(),
      })),
    });
  })

  // POST /finance/expenses
  .post(
    "/accounting/expenses",
    zValidator("json", expenseBodySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org    = c.get("org");
      const member = c.get("member");

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const body = c.req.valid("json");

      const cat = await prisma.expenseCategory.findUnique({ where: { id: body.categoryId } });
      if (!cat || cat.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "カテゴリが見つかりません" } }, 404);
      }

      const expense = await prisma.expense.create({
        data: {
          orgId:         org.id,
          categoryId:    body.categoryId,
          title:         body.title,
          amount:        body.amount,
          paymentMethod: body.paymentMethod ?? null,
          paidAt:        body.paidAt ? new Date(body.paidAt) : null,
          eventId:       body.eventId ?? null,
          note:          body.note    ?? null,
          recordedById:    member.id,
        },
        include: { category: { select: { id: true, name: true } } },
      });

      return c.json({
        data: {
          id:            expense.id,
          category:      { id: expense.category.id, name: expense.category.name },
          title:         expense.title,
          amount:        expense.amount,
          paymentMethod: expense.paymentMethod,
          paidAt:        expense.paidAt?.toISOString() ?? null,
          eventId:       expense.eventId,
          note:          expense.note,
          createdAt:     expense.createdAt.toISOString(),
        },
      }, 201);
    }
  )

  // PATCH /finance/expenses/:expenseId
  .patch(
    "/accounting/expenses/:expenseId",
    zValidator("json", expenseBodySchema.partial(), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org    = c.get("org");
      const member = c.get("member");
      const { expenseId } = c.req.param();

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const target = await prisma.expense.findFirst({ where: { id: expenseId, orgId: org.id } });
      if (!target) {
        return c.json({ error: { code: "NOT_FOUND", message: "支出が見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      const updated = await prisma.expense.update({
        where: { id: expenseId, orgId: org.id },
        data: {
          ...(body.categoryId    !== undefined && { categoryId: body.categoryId }),
          ...(body.title         !== undefined && { title: body.title }),
          ...(body.amount        !== undefined && { amount: body.amount }),
          ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
          ...(body.paidAt        !== undefined && { paidAt: body.paidAt ? new Date(body.paidAt) : null }),
          ...(body.eventId       !== undefined && { eventId: body.eventId }),
          ...(body.note          !== undefined && { note: body.note }),
        },
        include: { category: { select: { id: true, name: true } } },
      });

      return c.json({
        data: {
          id:            updated.id,
          category:      { id: updated.category.id, name: updated.category.name },
          title:         updated.title,
          amount:        updated.amount,
          paymentMethod: updated.paymentMethod,
          paidAt:        updated.paidAt?.toISOString() ?? null,
          eventId:       updated.eventId,
          note:          updated.note,
          createdAt:     updated.createdAt.toISOString(),
        },
      });
    }
  )

  // DELETE /finance/expenses/:expenseId
  .delete("/accounting/expenses/:expenseId", async (c) => {
    const org    = c.get("org");
    const member = c.get("member");
    const { expenseId } = c.req.param();

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const target = await prisma.expense.findFirst({ where: { id: expenseId, orgId: org.id } });
    if (!target) {
      return c.json({ error: { code: "NOT_FOUND", message: "支出が見つかりません" } }, 404);
    }

    await prisma.expense.delete({ where: { id: expenseId, orgId: org.id } });
    return new Response(null, { status: 204 });
  })

  // ════════════════════════════════════════
  // 徴収
  // ════════════════════════════════════════

  // GET /finance/collections
  .get("/accounting/collections", async (c) => {
    const org    = c.get("org");
    const member = c.get("member");

    if (!isFinancePlus(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const { from, to } = c.req.query();

    const collections = await prisma.collection.findMany({
      where: {
        orgId: org.id,
        ...(from || to ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
      },
      include: {
        payments: { select: { status: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      data: collections.map((col) => {
        const paid    = col.payments.filter((p) => p.status === "paid").length;
        const pending = col.payments.filter((p) => p.status === "pending").length;
        const waived  = col.payments.filter((p) => p.status === "waived").length;
        const paidAmount = col.payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount ?? col.amount), 0);
        return {
          id:         col.id,
          title:      col.title,
          amount:     col.amount,
          dueDate:    col.dueDate?.toISOString()  ?? null,
          eventId:    col.eventId,
          yearMonth:  col.yearMonth,
          note:       col.note,
          createdAt:  col.createdAt.toISOString(),
          summary:    { total: col.payments.length, paid, pending, waived, paidAmount },
        };
      }),
    });
  })

  // POST /finance/collections
  .post(
    "/accounting/collections",
    zValidator("json", collectionBodySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org    = c.get("org");
      const member = c.get("member");

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const body = c.req.valid("json");

      const col = await prisma.collection.create({
        data: {
          orgId:       org.id,
          title:       body.title,
          amount:      body.amount,
          dueDate:     body.dueDate   ? new Date(body.dueDate)   : null,
          eventId:     body.eventId   ?? null,
          yearMonth:   body.yearMonth ?? null,
          note:        body.note      ?? null,
          createdById: member.id,
        },
      });

      const targets = body.memberIds
        ? await prisma.member.findMany({ where: { id: { in: body.memberIds }, orgId: org.id }, include: { memberType: true } })
        : await prisma.member.findMany({ where: { orgId: org.id, status: "active", NOT: { roles: { hasSome: ["visitor"] } } }, include: { memberType: true } });

      await prisma.collectionPayment.createMany({
        data: targets.map((m) => ({
          collectionId: col.id,
          memberId:     m.id,
          status:       "pending" as const,
          amount: (m.memberType?.defaultFeeAmount != null && m.memberType.defaultFeeAmount !== body.amount)
            ? m.memberType.defaultFeeAmount
            : null,
        })),
      });

      return c.json({ data: { id: col.id, title: col.title, amount: col.amount } }, 201);
    }
  )

  // GET /finance/collections/:collectionId
  .get("/accounting/collections/:collectionId", async (c) => {
    const org    = c.get("org");
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
                userRef:    { select: { nameJa: true } },
                part:       { select: { id: true, name: true, voiceType: true, sortOrder: true } },
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
        id:        col.id,
        title:     col.title,
        amount:    col.amount,
        dueDate:   col.dueDate?.toISOString()  ?? null,
        eventId:   col.eventId,
        yearMonth: col.yearMonth,
        note:      col.note,
        createdAt: col.createdAt.toISOString(),
        payments:  col.payments.map((p) => ({
          id:        p.id,
          member:    {
            id:            p.member.id,
            nameJa:        p.member.userRef.nameJa,
            part:          p.member.part ? { id: p.member.part.id, name: p.member.part.name, voiceType: p.member.part.voiceType, sortOrder: p.member.part.sortOrder } : null,
            memberTypeFee: p.member.memberType?.defaultFeeAmount ?? null,
          },
          status:    p.status,
          amount:    p.amount,
          paidAt:    p.paidAt?.toISOString() ?? null,
          method:    p.method,
          note:      p.note,
        })),
      },
    });
  })

  // PATCH /finance/collections/:collectionId
  .patch(
    "/accounting/collections/:collectionId",
    zValidator("json", collectionBodySchema.omit({ memberIds: true }).partial(), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org    = c.get("org");
      const member = c.get("member");
      const { collectionId } = c.req.param();

      if (!isFinancePlus(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const target = await prisma.collection.findFirst({ where: { id: collectionId, orgId: org.id } });
      if (!target) {
        return c.json({ error: { code: "NOT_FOUND", message: "徴収が見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      const updated = await prisma.collection.update({
        where: { id: collectionId, orgId: org.id },
        data: {
          ...(body.title     !== undefined && { title: body.title }),
          ...(body.amount    !== undefined && { amount: body.amount }),
          ...(body.dueDate   !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
          ...(body.eventId   !== undefined && { eventId: body.eventId }),
          ...(body.yearMonth !== undefined && { yearMonth: body.yearMonth }),
          ...(body.note      !== undefined && { note: body.note }),
        },
      });

      return c.json({ data: { id: updated.id, title: updated.title, amount: updated.amount } });
    }
  )

  // DELETE /finance/collections/:collectionId
  .delete("/accounting/collections/:collectionId", async (c) => {
    const org    = c.get("org");
    const member = c.get("member");
    const { collectionId } = c.req.param();

    if (!isAdmin(member)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const target = await prisma.collection.findFirst({ where: { id: collectionId, orgId: org.id } });
    if (!target) {
      return c.json({ error: { code: "NOT_FOUND", message: "徴収が見つかりません" } }, 404);
    }

    await prisma.collection.delete({ where: { id: collectionId, orgId: org.id } });
    return new Response(null, { status: 204 });
  })

  // ════════════════════════════════════════
  // 支払い記録（個人単位）
  // ════════════════════════════════════════

  // PATCH /finance/collections/:collectionId/payments/:memberId
  .patch(
    "/accounting/collections/:collectionId/payments/:memberId",
    zValidator("json", z.object({
      status: z.enum(["pending", "paid", "waived"]),
      amount: z.number().int().positive().optional().nullable(),
      paidAt: z.string().date().optional().nullable(),
      method: paymentMethodSchema.optional().nullable(),
      note:   z.string().optional().nullable(),
    }), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org    = c.get("org");
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
        select: { orgId: true },
      });
      if (!targetMember || targetMember.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      const payment = await prisma.collectionPayment.upsert({
        where: { collectionId_memberId: { collectionId, memberId } },
        create: {
          collectionId,
          memberId,
          status:     body.status,
          amount:     body.amount     ?? null,
          paidAt:     body.paidAt     ? new Date(body.paidAt) : null,
          method:     body.method     ?? null,
          note:       body.note       ?? null,
          recordedById: member.id,
        },
        update: {
          status:     body.status,
          amount:     body.amount     ?? null,
          paidAt:     body.paidAt     ? new Date(body.paidAt) : null,
          method:     body.method     ?? null,
          note:       body.note       ?? null,
          recordedById: member.id,
        },
      });

      return c.json({
        data: {
          id:     payment.id,
          status: payment.status,
          amount: payment.amount,
          paidAt: payment.paidAt?.toISOString() ?? null,
          method: payment.method,
          note:   payment.note,
        },
      });
    }
  )

  // POST /finance/collections/:collectionId/payments/bulk
  // 複数メンバーの支払い状態を一括更新
  .post(
    "/accounting/collections/:collectionId/payments/bulk",
    zValidator("json", z.object({
      memberIds: z.array(z.string()).min(1),
      status:    z.enum(["pending", "paid", "waived"]),
      paidAt:    z.string().datetime({ offset: true }).optional().nullable(),
      method:    paymentMethodSchema.optional().nullable(),
    }), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const org    = c.get("org");
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
        select: { id: true },
      });
      if (validMembers.length !== body.memberIds.length) {
        return c.json({ error: { code: "BAD_REQUEST", message: "このテナントに存在しないメンバーIDが含まれています" } }, 400);
      }

      const paidAt = body.paidAt ? new Date(body.paidAt) : null;

      await prisma.$transaction(
        body.memberIds.map((mid) =>
          prisma.collectionPayment.upsert({
            where:  { collectionId_memberId: { collectionId, memberId: mid } },
            create: { collectionId, memberId: mid, status: body.status, paidAt, method: body.method ?? null, recordedById: member.id },
            update: { status: body.status, paidAt, method: body.method ?? null, recordedById: member.id },
          })
        )
      );

      return c.json({ data: { updated: body.memberIds.length } });
    }
  );
