import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isFinancePlus, isMemberPlus } from "../services/access.js";
import type { TenantEnv } from "../middleware/tenant.js";

export const settingsRouter = new Hono<TenantEnv>()

  // ── GET /settings ──
  .get("/settings", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isFinancePlus(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    return c.json({
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    });
  })

  // ── PATCH /settings ──
  .patch(
    "/settings",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const { name } = c.req.valid("json");

      const updated = await prisma.organization.update({
        where: { id: org.id },
        data: { name },
      });

      return c.json({
        data: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
        },
      });
    },
  )

  // ── POST /parts ──
  .post(
    "/parts",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        voiceType: z.string().default("other"),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const { name, voiceType } = c.req.valid("json");

      const maxOrder = await prisma.part.aggregate({
        where: { orgId: org.id },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

      const part = await prisma.part.create({
        data: { orgId: org.id, name, voiceType, sortOrder, isCustom: true },
      });

      return c.json(
        {
          data: {
            id: part.id,
            name: part.name,
            voiceType: part.voiceType,
            sortOrder: part.sortOrder,
          },
        },
        201,
      );
    },
  )

  // ── PATCH /parts/:partId ──
  .patch(
    "/parts/:partId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).optional(),
        sortOrder: z.number().int().positive().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { partId } = c.req.param();

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const target = await prisma.part.findUnique({ where: { id: partId } });
      if (!target || target.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "パートが見つかりません" } }, 404);
      }

      const updated = await prisma.part.update({
        where: { id: partId },
        data: c.req.valid("json"),
      });

      return c.json({
        data: {
          id: updated.id,
          name: updated.name,
          voiceType: updated.voiceType,
          sortOrder: updated.sortOrder,
        },
      });
    },
  )

  // ── DELETE /parts/:partId ──
  .delete("/parts/:partId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { partId } = c.req.param();

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const target = await prisma.part.findUnique({ where: { id: partId } });
    if (!target || target.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "パートが見つかりません" } }, 404);
    }

    if (!target.isCustom) {
      return c.json(
        { error: { code: "CONFLICT", message: "デフォルトパートは削除できません" } },
        409,
      );
    }

    const activeCount = await prisma.member.count({
      where: { partId, orgId: org.id, status: "active" },
    });
    if (activeCount > 0) {
      return c.json(
        { error: { code: "CONFLICT", message: "在団メンバーが所属しているため削除できません" } },
        409,
      );
    }

    await prisma.part.delete({ where: { id: partId } });
    return new Response(null, { status: 204 });
  })

  // ── GET /settings/org ──（会費設定取得）
  .get("/settings/org", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isFinancePlus(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    return c.json({
      data: {
        feeType: org.feeType,
        defaultFeeAmount: org.defaultFeeAmount,
      },
    });
  })

  // ── PATCH /settings/fee ──
  .patch(
    "/settings/fee",
    zValidator(
      "json",
      z.object({
        feeType: z.enum(["per_rehearsal", "monthly"]).optional(),
        defaultFeeAmount: z.number().int().nonnegative().nullable().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isFinancePlus(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const { feeType, defaultFeeAmount } = c.req.valid("json");
      const updated = await prisma.organization.update({
        where: { id: org.id },
        data: {
          ...(feeType !== undefined && { feeType }),
          ...(defaultFeeAmount !== undefined && { defaultFeeAmount }),
        },
      });

      return c.json({
        data: { feeType: updated.feeType, defaultFeeAmount: updated.defaultFeeAmount },
      });
    },
  )

  // ── GET /settings/expense-categories ──
  .get("/settings/expense-categories", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isFinancePlus(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const cats = await prisma.expenseCategory.findMany({
      where: { orgId: org.id },
      orderBy: { sortOrder: "asc" },
    });
    return c.json({
      data: cats.map((cat) => ({ id: cat.id, name: cat.name, sortOrder: cat.sortOrder })),
    });
  })

  // ── POST /settings/expense-categories ──
  .post(
    "/settings/expense-categories",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(50),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isFinancePlus(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const { name, sortOrder } = c.req.valid("json");

      const maxOrder = await prisma.expenseCategory.aggregate({
        where: { orgId: org.id },
        _max: { sortOrder: true },
      });
      const order = sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1;

      const cat = await prisma.expenseCategory.create({
        data: { orgId: org.id, name, sortOrder: order },
      });

      return c.json({ data: { id: cat.id, name: cat.name, sortOrder: cat.sortOrder } }, 201);
    },
  )

  // ── PATCH /settings/expense-categories/:categoryId ──
  .patch(
    "/settings/expense-categories/:categoryId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(50).optional(),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { categoryId } = c.req.param();

      if (!isFinancePlus(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
      }

      const target = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
      if (!target || target.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "カテゴリが見つかりません" } }, 404);
      }

      const updated = await prisma.expenseCategory.update({
        where: { id: categoryId },
        data: c.req.valid("json"),
      });

      return c.json({ data: { id: updated.id, name: updated.name, sortOrder: updated.sortOrder } });
    },
  )

  // ── DELETE /settings/expense-categories/:categoryId ──
  .delete("/settings/expense-categories/:categoryId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { categoryId } = c.req.param();

    if (!isFinancePlus(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "会計以上の権限が必要です" } }, 403);
    }

    const target = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!target || target.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "カテゴリが見つかりません" } }, 404);
    }

    const usedCount = await prisma.expense.count({ where: { categoryId, orgId: org.id } });
    if (usedCount > 0) {
      return c.json(
        { error: { code: "CONFLICT", message: "支出記録が紐付いているため削除できません" } },
        409,
      );
    }

    await prisma.expenseCategory.delete({ where: { id: categoryId } });
    return new Response(null, { status: 204 });
  })

  // ════════════════════════════════════════
  // メンバー区分マスタ
  // ════════════════════════════════════════

  // ── GET /settings/member-types ──
  .get("/settings/member-types", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isMemberPlus(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "閲覧権限がありません" } }, 403);
    }

    const types = await prisma.memberType.findMany({
      where: { orgId: org.id },
      orderBy: { sortOrder: "asc" },
    });
    return c.json({
      data: types.map((t) => ({
        id: t.id,
        name: t.name,
        defaultFeeAmount: t.defaultFeeAmount,
        sortOrder: t.sortOrder,
      })),
    });
  })

  // ── POST /settings/member-types ──
  .post(
    "/settings/member-types",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(50),
        defaultFeeAmount: z.number().int().nonnegative().optional().nullable(),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const { name, defaultFeeAmount, sortOrder } = c.req.valid("json");

      const maxOrder = await prisma.memberType.aggregate({
        where: { orgId: org.id },
        _max: { sortOrder: true },
      });
      const order = sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1;

      const created = await prisma.memberType.create({
        data: { orgId: org.id, name, defaultFeeAmount: defaultFeeAmount ?? null, sortOrder: order },
      });

      return c.json(
        {
          data: {
            id: created.id,
            name: created.name,
            defaultFeeAmount: created.defaultFeeAmount,
            sortOrder: created.sortOrder,
          },
        },
        201,
      );
    },
  )

  // ── PATCH /settings/member-types/:typeId ──
  .patch(
    "/settings/member-types/:typeId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(50).optional(),
        defaultFeeAmount: z.number().int().nonnegative().optional().nullable(),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { typeId } = c.req.param();

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const target = await prisma.memberType.findUnique({ where: { id: typeId } });
      if (!target || target.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "区分が見つかりません" } }, 404);
      }

      const updated = await prisma.memberType.update({
        where: { id: typeId },
        data: c.req.valid("json"),
      });

      return c.json({
        data: {
          id: updated.id,
          name: updated.name,
          defaultFeeAmount: updated.defaultFeeAmount,
          sortOrder: updated.sortOrder,
        },
      });
    },
  )

  // ── DELETE /settings/member-types/:typeId ──
  .delete("/settings/member-types/:typeId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { typeId } = c.req.param();

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const target = await prisma.memberType.findUnique({ where: { id: typeId } });
    if (!target || target.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "区分が見つかりません" } }, 404);
    }

    const usedCount = await prisma.member.count({ where: { memberTypeId: typeId, orgId: org.id } });
    if (usedCount > 0) {
      return c.json(
        { error: { code: "CONFLICT", message: `${usedCount}名が使用中のため削除できません` } },
        409,
      );
    }

    await prisma.memberType.delete({ where: { id: typeId } });
    return new Response(null, { status: 204 });
  })

  // ════════════════════════════════════════
  // イベント区分マスタ
  // ════════════════════════════════════════

  // ── GET /settings/event-categories ──
  .get("/settings/event-categories", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isMemberPlus(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "閲覧権限がありません" } }, 403);
    }

    const cats = await prisma.eventCategory.findMany({
      where: { orgId: org.id },
      orderBy: { sortOrder: "asc" },
    });
    return c.json({
      data: cats.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        color: cat.color,
        sortOrder: cat.sortOrder,
      })),
    });
  })

  // ── POST /settings/event-categories ──
  .post(
    "/settings/event-categories",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(50),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const { name, color, sortOrder } = c.req.valid("json");

      const maxOrder = await prisma.eventCategory.aggregate({
        where: { orgId: org.id },
        _max: { sortOrder: true },
      });
      const order = sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1;

      const cat = await prisma.eventCategory.create({
        data: { orgId: org.id, name, color: color ?? "#6B7280", sortOrder: order },
      });

      return c.json(
        {
          data: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            color: cat.color,
            sortOrder: cat.sortOrder,
          },
        },
        201,
      );
    },
  )

  // ── PATCH /settings/event-categories/:categoryId ──
  .patch(
    "/settings/event-categories/:categoryId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).max(50).optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        sortOrder: z.number().int().nonnegative().optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
        }
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { categoryId } = c.req.param();

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
      }

      const target = await prisma.eventCategory.findUnique({ where: { id: categoryId } });
      if (!target || target.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "区分が見つかりません" } }, 404);
      }

      const updated = await prisma.eventCategory.update({
        where: { id: categoryId },
        data: c.req.valid("json"),
      });

      return c.json({
        data: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          color: updated.color,
          sortOrder: updated.sortOrder,
        },
      });
    },
  )

  // ── DELETE /settings/event-categories/:categoryId ──
  .delete("/settings/event-categories/:categoryId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { categoryId } = c.req.param();

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const target = await prisma.eventCategory.findUnique({ where: { id: categoryId } });
    if (!target || target.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "区分が見つかりません" } }, 404);
    }

    if (target.slug !== null) {
      return c.json(
        { error: { code: "CONFLICT", message: "システム標準区分は削除できません" } },
        409,
      );
    }

    const usedCount = await prisma.event.count({
      where: { categoryId, category: { orgId: org.id } },
    });
    if (usedCount > 0) {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: `${usedCount}件のイベントが使用中のため削除できません`,
          },
        },
        409,
      );
    }

    await prisma.eventCategory.delete({ where: { id: categoryId } });
    return new Response(null, { status: 204 });
  })

  // ── GET /settings/visitor-webhook ──
  .get("/settings/visitor-webhook", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    return c.json({ data: { token: org.visitorFormToken } });
  })

  // ── POST /settings/visitor-webhook/regenerate ──
  .post("/settings/visitor-webhook/regenerate", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }, 403);
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { visitorFormToken: randomUUID() },
    });

    return c.json({ data: { token: updated.visitorFormToken } });
  });
