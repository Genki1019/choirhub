import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isTicketManager } from "../services/access.js";
import type { TenantEnv } from "../middleware/tenant.js";

export const ticketsRouter = new Hono<TenantEnv>()

  // ── GET /tickets ── 演奏会ごとの配布状況一覧
  .get("/tickets", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみアクセスできます" } }, 403);
    }

    const concerts = await prisma.concert.findMany({
      where: { orgId: org.id },
      orderBy: { heldOn: "asc" },
      include: {
        ticketBatches: {
          include: {
            allocations: { select: { allocatedCount: true, soldAdult: true, soldStudent: true, soldOther: true, isCollected: true } },
          },
        },
      },
    });

    return c.json({
      data: concerts.map((concert) => {
        const batches = concert.ticketBatches;
        const totalAllocated = batches.flatMap((b) => b.allocations).reduce((s, a) => s + a.allocatedCount, 0);
        const totalSold = batches.flatMap((b) => b.allocations).reduce((s, a) => s + a.soldAdult + a.soldStudent + a.soldOther, 0);
        const totalCollected = batches.flatMap((b) => b.allocations).filter((a) => a.isCollected).length;
        const totalMembers = batches.flatMap((b) => b.allocations).length;

        return {
          concertId: concert.id,
          title: concert.title,
          heldOn: concert.heldOn.toISOString(),
          status: concert.status,
          batchCount: batches.length,
          totalAllocated,
          totalSold,
          soldRate: totalAllocated > 0 ? totalSold / totalAllocated : 0,
          collectedCount: totalCollected,
          memberCount: totalMembers,
        };
      }),
    });
  })

  // ── GET /tickets/my ── 自分のチケット配布状況一覧（全団員アクセス可）
  .get("/tickets/my", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    const allocations = await prisma.ticketAllocation.findMany({
      where: { memberId: actingMember.id, batch: { concert: { orgId: org.id } } },
      include: {
        batch: {
          include: { concert: true },
        },
      },
      orderBy: { batch: { concert: { heldOn: "asc" } } },
    });

    // 演奏会ごとにグループ化
    const concertMap = new Map<string, {
      concertId: string;
      title: string;
      heldOn: string;
      racePublishedAt: string | null;
      ticketInputClosedAt: string | null;
      batches: {
        allocationId: string;
        batchId: string;
        batchName: string;
        price: number;
        priceStudent: number | null;
        allocatedCount: number;
        requestedCount: number | null;
        soldAdult: number;
        soldStudent: number;
        soldOther: number;
        returnedCount: number;
        outreachCount: number;
        reportedAt: string | null;
      }[];
    }>();

    for (const a of allocations) {
      if (a.batch.concert.orgId !== org.id) continue;
      const key = a.batch.concertId;
      if (!concertMap.has(key)) {
        concertMap.set(key, {
          concertId: a.batch.concert.id,
          title: a.batch.concert.title,
          heldOn: a.batch.concert.heldOn.toISOString(),
          racePublishedAt: a.batch.concert.racePublishedAt?.toISOString() ?? null,
          ticketInputClosedAt: a.batch.concert.ticketInputClosedAt?.toISOString() ?? null,
          batches: [],
        });
      }
      concertMap.get(key)!.batches.push({
        allocationId: a.id,
        batchId: a.batch.id,
        batchName: a.batch.name,
        price: a.batch.price,
        priceStudent: a.batch.priceStudent,
        allocatedCount: a.allocatedCount,
        requestedCount: a.requestedCount,
        soldAdult: a.soldAdult,
        soldStudent: a.soldStudent,
        soldOther: a.soldOther,
        returnedCount: a.returnedCount,
        outreachCount: a.outreachCount,
        reportedAt: a.reportedAt?.toISOString() ?? null,
      });
    }

    return c.json({ data: Array.from(concertMap.values()) });
  })

  // ── GET /tickets/:concertId ── チケット配布・集計
  .get("/tickets/:concertId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId } = c.req.param();

    if (!isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみアクセスできます" } }, 403);
    }

    const concert = await prisma.concert.findUnique({ where: { id: concertId } });
    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    const batches = await prisma.ticketBatch.findMany({
      where: { concertId },
      orderBy: { createdAt: "asc" },
      include: {
        allocations: {
          where: { member: { NOT: { roles: { hasSome: ["guest", "visitor"] } } } },
          include: {
            member: {
              include: {
                userRef: { select: { nameJa: true } },
                part: { select: { id: true, name: true, sortOrder: true, voiceType: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const parts = await prisma.part.findMany({ where: { orgId: org.id }, orderBy: { sortOrder: "asc" } });

    // パート別集計
    const partSummary = parts.map((part) => {
      const allocations = batches.flatMap((b) =>
        b.allocations.filter((a) => a.member.part?.id === part.id)
      );
      const allocated = allocations.reduce((s, a) => s + a.allocatedCount, 0);
      const sold = allocations.reduce((s, a) => s + a.soldAdult + a.soldStudent + a.soldOther, 0);
      if (allocated === 0) return null;
      return { partId: part.id, partName: part.name, allocated, sold, rate: sold / allocated };
    }).filter(Boolean);

    return c.json({
      data: {
        concert: {
          id: concert.id,
          title: concert.title,
          heldOn: concert.heldOn.toISOString(),
          ticketInputClosedAt: concert.ticketInputClosedAt?.toISOString() ?? null,
          outreachExpensePerTrip: concert.outreachExpensePerTrip ?? null,
        },
        isAdmin: isAdmin(actingMember),
        myMemberId: actingMember.id,
        batches: batches.map((batch) => ({
          id: batch.id,
          name: batch.name,
          price: batch.price,
          priceStudent: batch.priceStudent,
          totalCount: batch.totalCount,
          saleStart: batch.saleStart?.toISOString() ?? null,
          saleEnd: batch.saleEnd?.toISOString() ?? null,
          allocations: batch.allocations.map((a) => ({
            id: a.id,
            batchId: batch.id,
            memberId: a.memberId,
            nameJa: a.member.userRef.nameJa,
            partId: a.member.part?.id ?? null,
            partName: a.member.part?.name ?? null,
            partSortOrder: a.member.part?.sortOrder ?? 99,
            partVoiceType: a.member.part?.voiceType ?? "other",
            allocatedCount: a.allocatedCount,
            requestedCount: a.requestedCount,
            soldAdult: a.soldAdult,
            soldStudent: a.soldStudent,
            soldOther: a.soldOther,
            returnedCount: a.returnedCount,
            outreachCount: a.outreachCount,
            isOutreachExpensePaid: a.isOutreachExpensePaid,
            outreachExpensePaidAt: a.outreachExpensePaidAt?.toISOString() ?? null,
            collected: a.isCollected,
            reportedAt: a.reportedAt?.toISOString() ?? null,
          })),
        })),
        partSummary,
      },
    });
  })

  // ── PATCH /tickets/allocations/:id ── 販売・回収報告を更新
  .patch(
    "/tickets/allocations/:id",
    zValidator("json", z.object({
      allocatedCount:      z.number().int().min(0).optional(),
      soldAdult:           z.number().int().min(0).optional(),
      soldStudent:         z.number().int().min(0).optional(),
      soldOther:           z.number().int().min(0).optional(),
      returnedCount:       z.number().int().min(0).optional(),
      outreachCount:       z.number().int().min(0).optional(),
      isOutreachExpensePaid: z.boolean().optional(),
      isCollected:         z.boolean().optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const { id } = c.req.param();

      const allocation = await prisma.ticketAllocation.findUnique({
        where: { id },
        include: { batch: { include: { concert: true } } },
      });

      if (!allocation || allocation.batch.concert.orgId !== c.get("org").id) {
        return c.json({ error: { code: "NOT_FOUND", message: "配布記録が見つかりません" } }, 404);
      }

      const isSelf = allocation.memberId === actingMember.id;
      const isMgr  = isTicketManager(actingMember);

      if (!isMgr && !isSelf) {
        return c.json({ error: { code: "FORBIDDEN", message: "自分の配布記録のみ編集できます" } }, 403);
      }

      if (!isMgr && allocation.batch.concert.ticketInputClosedAt && new Date() > allocation.batch.concert.ticketInputClosedAt) {
        return c.json({ error: { code: "INPUT_CLOSED", message: "チケット入力は締め切られています" } }, 403);
      }

      const body = c.req.valid("json");
      const { allocatedCount, isOutreachExpensePaid, ...salesBody } = body;

      const hasSalesChange =
        body.soldAdult !== undefined ||
        body.soldStudent !== undefined ||
        body.soldOther !== undefined ||
        body.returnedCount !== undefined;

      // allocatedCount 変更は管理者のみ。承認として requestedCount をクリア
      if (allocatedCount !== undefined && !isMgr) {
        return c.json({ error: { code: "FORBIDDEN", message: "配布枚数の変更はチケット担当者のみ可能です" } }, 403);
      }
      // 交通費支払い記録は管理者のみ
      if (isOutreachExpensePaid !== undefined && !isMgr) {
        return c.json({ error: { code: "FORBIDDEN", message: "情宣交通費の記録はチケット担当者のみ可能です" } }, 403);
      }

      const updated = await prisma.ticketAllocation.update({
        where: { id, batch: { concert: { orgId: c.get("org").id } } },
        data: {
          ...salesBody,
          ...(allocatedCount !== undefined ? { allocatedCount, requestedCount: null } : {}),
          ...(isOutreachExpensePaid !== undefined ? {
            isOutreachExpensePaid,
            outreachExpensePaidAt: isOutreachExpensePaid ? new Date() : null,
          } : {}),
          ...(hasSalesChange ? { reportedAt: new Date() } : {}),
        },
      });

      return c.json({
        data: {
          id:             updated.id,
          allocatedCount: updated.allocatedCount,
          requestedCount: updated.requestedCount,
          soldAdult:      updated.soldAdult,
          soldStudent:    updated.soldStudent,
          soldOther:      updated.soldOther,
          returnedCount:  updated.returnedCount,
          isCollected: updated.isCollected,
          reportedAt:     updated.reportedAt?.toISOString() ?? null,
        },
      });
    }
  )

  // ── POST /tickets/:concertId/outreach-expenses/bulk ── 情宣交通費 一括支払い記録（ticket/admin）
  .post(
    "/tickets/:concertId/outreach-expenses/bulk",
    zValidator("json", z.object({
      allocationIds: z.array(z.string()).min(1),
      paid:          z.boolean(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { concertId } = c.req.param();

      if (!isTicketManager(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
      }

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { allocationIds, paid } = c.req.valid("json");

      const validAllocations = await prisma.ticketAllocation.findMany({
        where: { id: { in: allocationIds }, batch: { concertId, concert: { orgId: org.id } } },
        select: { id: true },
      });
      if (validAllocations.length !== allocationIds.length) {
        return c.json({ error: { code: "BAD_REQUEST", message: "一部の配布記録が見つかりません" } }, 400);
      }

      const { count } = await prisma.ticketAllocation.updateMany({
        where: {
          id:    { in: allocationIds },
          batch: { concertId, concert: { orgId: org.id } },
        },
        data: {
          isOutreachExpensePaid: paid,
          outreachExpensePaidAt: paid ? new Date() : null,
        },
      });

      return c.json({ data: { updatedCount: count } });
    },
  )

  // ── PATCH /concerts/:concertId/outreach-expense-rate ── 単価設定（ticket/admin）
  .patch(
    "/tickets/:concertId/outreach-expense-rate",
    zValidator("json", z.object({
      outreachExpensePerTrip: z.number().int().min(0).nullable(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { concertId } = c.req.param();

      if (!isTicketManager(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
      }

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { outreachExpensePerTrip } = c.req.valid("json");
      await prisma.concert.update({ where: { id: concertId }, data: { outreachExpensePerTrip } });
      return c.json({ data: { outreachExpensePerTrip } });
    },
  )

  // ── POST /tickets/:concertId/batches ── 席種作成（T-5）
  .post(
    "/tickets/:concertId/batches",
    zValidator("json", z.object({
      name:         z.string().min(1),
      price:        z.number().int().min(0),
      priceStudent: z.number().int().min(0).optional().nullable(),
      totalCount:   z.number().int().min(1),
      saleStart:    z.string().datetime({ offset: true }).optional().nullable(),
      saleEnd:      z.string().datetime({ offset: true }).optional().nullable(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { concertId } = c.req.param();

      if (!isTicketManager(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
      }

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { name, price, priceStudent, totalCount, saleStart, saleEnd } = c.req.valid("json");

      const batch = await prisma.ticketBatch.create({
        data: {
          concertId,
          name,
          price,
          priceStudent: priceStudent ?? null,
          totalCount,
          saleStart: saleStart ? new Date(saleStart) : null,
          saleEnd:   saleEnd   ? new Date(saleEnd)   : null,
        },
      });

      return c.json({
        data: {
          id:           batch.id,
          name:         batch.name,
          price:        batch.price,
          priceStudent: batch.priceStudent,
          totalCount:   batch.totalCount,
          saleStart:    batch.saleStart?.toISOString() ?? null,
          saleEnd:      batch.saleEnd?.toISOString()   ?? null,
          allocations:  [],
        },
      }, 201);
    }
  )

  // ── POST /tickets/:concertId/allocate ── 配布登録（T-6）
  .post(
    "/tickets/:concertId/allocate",
    zValidator("json", z.object({
      batchId:        z.string(),
      memberId:       z.string().optional(),
      allocatedCount: z.number().int().min(0),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { concertId } = c.req.param();
      const { batchId, memberId: rawMemberId, allocatedCount } = c.req.valid("json");

      const targetMemberId = rawMemberId ?? actingMember.id;
      const isSelf = targetMemberId === actingMember.id;

      if (!isSelf && !isTicketManager(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "他のメンバーへの配布登録はチケット担当者または管理者のみ可能です" } }, 403);
      }

      const batch = await prisma.ticketBatch.findUnique({
        where: { id: batchId },
        include: { concert: true },
      });
      if (!batch || batch.concert.orgId !== org.id || batch.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "席種が見つかりません" } }, 404);
      }

      if (isSelf && !isTicketManager(actingMember) && batch.concert.ticketInputClosedAt) {
        return c.json({ error: { code: "INPUT_CLOSED", message: "チケット入力は締め切られています" } }, 403);
      }

      const isMgr = isTicketManager(actingMember);

      const allocation = await prisma.ticketAllocation.upsert({
        where: { batchId_memberId: { batchId, memberId: targetMemberId } },
        create: isMgr
          ? { batchId, memberId: targetMemberId, allocatedCount }
          : { batchId, memberId: targetMemberId, requestedCount: allocatedCount },
        update: isMgr
          ? { allocatedCount, requestedCount: null }
          : { requestedCount: allocatedCount },
      });

      return c.json({
        data: {
          id:             allocation.id,
          batchId:        allocation.batchId,
          memberId:       allocation.memberId,
          allocatedCount: allocation.allocatedCount,
          requestedCount: allocation.requestedCount,
        },
      }, 201);
    }
  )

  // ── PATCH /tickets/:concertId/batches/:batchId ── 席種情報更新
  .patch(
    "/tickets/:concertId/batches/:batchId",
    zValidator("json", z.object({
      name:         z.string().min(1).optional(),
      price:        z.number().int().min(0).optional(),
      priceStudent: z.number().int().min(0).nullable().optional(),
      totalCount:   z.number().int().min(1).optional(),
      saleStart:    z.string().datetime({ offset: true }).nullable().optional(),
      saleEnd:      z.string().datetime({ offset: true }).nullable().optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { concertId, batchId } = c.req.param();

      if (!isTicketManager(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
      }

      const batch = await prisma.ticketBatch.findUnique({
        where: { id: batchId },
        include: { concert: true },
      });
      if (!batch || batch.concert.orgId !== org.id || batch.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "席種が見つかりません" } }, 404);
      }

      const { name, price, priceStudent, totalCount, saleStart, saleEnd } = c.req.valid("json");

      const updated = await prisma.ticketBatch.update({
        where: { id: batchId },
        data: {
          ...(name         !== undefined ? { name }         : {}),
          ...(price        !== undefined ? { price }        : {}),
          ...(priceStudent !== undefined ? { priceStudent } : {}),
          ...(totalCount   !== undefined ? { totalCount }   : {}),
          ...(saleStart    !== undefined ? { saleStart: saleStart ? new Date(saleStart) : null } : {}),
          ...(saleEnd      !== undefined ? { saleEnd:   saleEnd   ? new Date(saleEnd)   : null } : {}),
        },
      });

      return c.json({
        data: {
          id:           updated.id,
          name:         updated.name,
          price:        updated.price,
          priceStudent: updated.priceStudent,
          totalCount:   updated.totalCount,
          saleStart:    updated.saleStart?.toISOString() ?? null,
          saleEnd:      updated.saleEnd?.toISOString()   ?? null,
        },
      });
    }
  )

  // ── DELETE /tickets/:concertId/batches/:batchId ── 席種削除
  .delete("/tickets/:concertId/batches/:batchId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId, batchId } = c.req.param();

    if (!isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
    }

    const batch = await prisma.ticketBatch.findUnique({
      where: { id: batchId },
      include: { concert: true },
    });
    if (!batch || batch.concert.orgId !== org.id || batch.concertId !== concertId) {
      return c.json({ error: { code: "NOT_FOUND", message: "席種が見つかりません" } }, 404);
    }

    await prisma.ticketBatch.delete({ where: { id: batchId } });
    return c.body(null, 204);
  })

  // ── GET /tickets/:concertId/race ── チケットレース（スコアリング）
  .get("/tickets/:concertId/race", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId } = c.req.param();

    const concert = await prisma.concert.findUnique({ where: { id: concertId } });
    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    // 公開済みなら全員閲覧可、未公開はチケット担当のみ
    if (!concert.racePublishedAt && !isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみアクセスできます" } }, 403);
    }

    // ── スコアリング設定（可変） ──
    const SCORING = {
      avgSales:  { label: "平均販売枚数",       points: [10, 8, 6, 4] },
      speed5:    { label: "速さ（5枚×3名）",    threshold: 5,  minCount: 3, points: [5, 4, 3, 2] },
      speed10:   { label: "速さ（10枚×3名）",   threshold: 10, minCount: 3, points: [5, 4, 3, 2] },
      zeroRatio: { label: "ゼロ販売割合（少順）", points: [4, 3, 2, 1] },
      outreach:  { label: "情宣回数",           points: [5, 4, 3, 2] },
    };

    // ランクに基づきポイント付与（同率タイ対応）
    function assignRankedPoints(
      items: Array<{ key: string; value: number }>,
      points: number[],
      higherIsBetter = true,
    ): Map<string, number> {
      const result = new Map<string, number>(items.map((i) => [i.key, 0]));
      if (!items.length) return result;
      const sorted = [...items].sort((a, b) =>
        higherIsBetter ? b.value - a.value : a.value - b.value,
      );
      let i = 0;
      while (i < sorted.length) {
        const cur = sorted[i].value;
        let j = i;
        while (j < sorted.length && sorted[j].value === cur) j++;
        const tiedPts = points.slice(i, j);
        const avg = tiedPts.length
          ? Math.round(tiedPts.reduce((s, p) => s + p, 0) / tiedPts.length)
          : 0;
        for (let k = i; k < j; k++) result.set(sorted[k].key, avg);
        i = j;
      }
      return result;
    }

    const batches = await prisma.ticketBatch.findMany({
      where: { concertId },
      include: {
        allocations: {
          where: {
            member: { NOT: { roles: { hasSome: ["guest", "visitor"] } } },
          },
          include: {
            member: {
              include: {
                userRef: { select: { nameJa: true } },
                part: { select: { id: true, name: true, sortOrder: true, voiceType: true } },
              },
            },
          },
        },
      },
    });

    // 団員ごとに全席種を合算
    type MemberRaw = {
      memberId: string;
      nameJa: string;
      partId: string | null;
      partName: string | null;
      partSortOrder: number;
      partVoiceType: string;
      allocated: number;
      sold: number;
      outreachCount: number;
      reportedAt: Date | null;
    };

    const memberMap = new Map<string, MemberRaw>();
    for (const batch of batches) {
      for (const a of batch.allocations) {
        const key = a.memberId;
        if (!memberMap.has(key)) {
          memberMap.set(key, {
            memberId: a.memberId,
            nameJa: a.member.userRef.nameJa,
            partId: a.member.part?.id ?? null,
            partName: a.member.part?.name ?? null,
            partSortOrder: a.member.part?.sortOrder ?? 99,
            partVoiceType: a.member.part?.voiceType ?? "other",
            allocated: 0,
            sold: 0,
            outreachCount: 0,
            reportedAt: null,
          });
        }
        const m = memberMap.get(key)!;
        m.allocated += a.allocatedCount;
        m.sold += a.soldAdult + a.soldStudent + a.soldOther;
        // 情宣回数は最大値を採用（複数席種で重複計上を防ぐ）
        if (a.outreachCount > m.outreachCount) m.outreachCount = a.outreachCount;
        if (a.reportedAt && (!m.reportedAt || a.reportedAt > m.reportedAt)) {
          m.reportedAt = a.reportedAt;
        }
      }
    }

    const members = Array.from(memberMap.values()).filter((m) => m.allocated > 0);

    // ── パート集計 ──
    type PartRaw = {
      partId: string;
      partName: string;
      members: MemberRaw[];
    };

    const partMap = new Map<string, PartRaw>();
    for (const m of members) {
      const key = m.partId ?? "__none__";
      if (!partMap.has(key)) {
        partMap.set(key, {
          partId: m.partId ?? "",
          partName: m.partName ?? "パート未設定",
          members: [],
        });
      }
      partMap.get(key)!.members.push(m);
    }
    const parts = Array.from(partMap.values());

    // 速さマイルストーン計算（Nth人がthresholdに達した日時）
    function speedMilestoneTime(
      partMembers: MemberRaw[],
      threshold: number,
      minCount: number,
    ): number | null {
      const eligible = partMembers
        .filter((m) => m.sold >= threshold && m.reportedAt)
        .sort((a, b) => a.reportedAt!.getTime() - b.reportedAt!.getTime());
      if (eligible.length < minCount) return null;
      return eligible[minCount - 1].reportedAt!.getTime();
    }

    // ── 各基準でポイント付与 ──

    // 1. 平均販売枚数
    const avgSalesMap = assignRankedPoints(
      parts.map((p) => ({
        key: p.partId,
        value: p.members.length > 0 ? p.members.reduce((s, m) => s + m.sold, 0) / p.members.length : 0,
      })),
      SCORING.avgSales.points,
    );

    // 2. 速さ（5枚×3名）
    const speed5Timestamps = parts.map((p) => ({
      key: p.partId,
      value: speedMilestoneTime(p.members, SCORING.speed5.threshold, SCORING.speed5.minCount),
    }));
    const speed5Map = assignRankedPoints(
      speed5Timestamps.filter((x): x is { key: string; value: number } => x.value !== null),
      SCORING.speed5.points,
      false, // 早い（小さい）順が上位
    );
    parts.forEach((p) => { if (!speed5Map.has(p.partId)) speed5Map.set(p.partId, 0); });

    // 3. 速さ（10枚×3名）
    const speed10Timestamps = parts.map((p) => ({
      key: p.partId,
      value: speedMilestoneTime(p.members, SCORING.speed10.threshold, SCORING.speed10.minCount),
    }));
    const speed10Map = assignRankedPoints(
      speed10Timestamps.filter((x): x is { key: string; value: number } => x.value !== null),
      SCORING.speed10.points,
      false,
    );
    parts.forEach((p) => { if (!speed10Map.has(p.partId)) speed10Map.set(p.partId, 0); });

    // 4. ゼロ販売割合（小さい順が上位）
    const zeroRatioMap = assignRankedPoints(
      parts.map((p) => ({
        key: p.partId,
        value: p.members.length > 0
          ? p.members.filter((m) => m.sold === 0).length / p.members.length
          : 1,
      })),
      SCORING.zeroRatio.points,
      false,
    );

    // 5. 情宣回数（合計）
    const outreachMap = assignRankedPoints(
      parts.map((p) => ({
        key: p.partId,
        value: p.members.reduce((s, m) => s + m.outreachCount, 0),
      })),
      SCORING.outreach.points,
    );

    // ── パート最終スコア組み立て ──
    const scoredParts = parts.map((p) => {
      const allocated = p.members.reduce((s, m) => s + m.allocated, 0);
      const sold = p.members.reduce((s, m) => s + m.sold, 0);
      const avgSalesPoints  = avgSalesMap.get(p.partId)  ?? 0;
      const speed5Points    = speed5Map.get(p.partId)    ?? 0;
      const speed10Points   = speed10Map.get(p.partId)   ?? 0;
      const zeroRatioPoints = zeroRatioMap.get(p.partId) ?? 0;
      const outreachPoints  = outreachMap.get(p.partId)  ?? 0;
      const totalPoints = avgSalesPoints + speed5Points + speed10Points + zeroRatioPoints + outreachPoints;
      const speed5AchievedAt = speed5Timestamps.find((x) => x.key === p.partId)?.value ?? null;
      const speed10AchievedAt = speed10Timestamps.find((x) => x.key === p.partId)?.value ?? null;
      return {
        partId:   p.partId,
        partName: p.partName,
        totalPoints,
        breakdown: { avgSalesPoints, speed5Points, speed10Points, zeroRatioPoints, outreachPoints },
        stats: {
          avgSold: p.members.length > 0 ? sold / p.members.length : 0,
          speed5AchievedAt:  speed5AchievedAt  ? new Date(speed5AchievedAt).toISOString()  : null,
          speed10AchievedAt: speed10AchievedAt ? new Date(speed10AchievedAt).toISOString() : null,
          zeroSellerRatio: p.members.length > 0 ? p.members.filter((m) => m.sold === 0).length / p.members.length : 1,
          totalOutreach: p.members.reduce((s, m) => s + m.outreachCount, 0),
          memberCount: p.members.length,
          allocated,
          sold,
        },
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    // ── 個人ランキング（販売枚数順 → 情宣回数順） ──
    const individuals = members
      .sort((a, b) => b.sold - a.sold || b.outreachCount - a.outreachCount)
      .map((m, i) => ({
        memberId:     m.memberId,
        nameJa:       m.nameJa,
        partId:       m.partId,
        partName:     m.partName,
        allocated:    m.allocated,
        sold:         m.sold,
        outreachCount: m.outreachCount,
        rate:         m.allocated > 0 ? m.sold / m.allocated : 0,
        rank:         i + 1,
      }));

    return c.json({
      data: {
        concert: { id: concert.id, title: concert.title },
        isTicketManager: isTicketManager(actingMember),
        racePublishedAt: concert.racePublishedAt?.toISOString() ?? null,
        scoring: SCORING,
        parts: scoredParts,
        individuals,
      },
    });
  })

  // ── POST /tickets/:concertId/race/publish ── チケットレース公開
  .post("/tickets/:concertId/race/publish", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId } = c.req.param();

    if (!isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
    }

    const concert = await prisma.concert.findUnique({ where: { id: concertId } });
    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    const updated = await prisma.concert.update({
      where: { id: concertId },
      data: { racePublishedAt: new Date() },
    });

    return c.json({ data: { racePublishedAt: updated.racePublishedAt?.toISOString() ?? null } });
  })

  // ── DELETE /tickets/:concertId/race/publish ── チケットレース公開取消
  .delete("/tickets/:concertId/race/publish", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId } = c.req.param();

    if (!isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
    }

    const concert = await prisma.concert.findUnique({ where: { id: concertId } });
    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    await prisma.concert.update({
      where: { id: concertId },
      data: { racePublishedAt: null },
    });

    return c.json({ data: { racePublishedAt: null } });
  })

  // ── POST /tickets/:concertId/close ── チケット入力締め切り
  .post("/tickets/:concertId/close", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId } = c.req.param();

    if (!isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
    }

    const concert = await prisma.concert.findUnique({ where: { id: concertId } });
    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    const updated = await prisma.concert.update({
      where: { id: concertId },
      data: { ticketInputClosedAt: new Date() },
    });

    return c.json({ data: { ticketInputClosedAt: updated.ticketInputClosedAt?.toISOString() ?? null } });
  })

  // ── DELETE /tickets/:concertId/close ── チケット入力再開
  .delete("/tickets/:concertId/close", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId } = c.req.param();

    if (!isTicketManager(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } }, 403);
    }

    const concert = await prisma.concert.findUnique({ where: { id: concertId } });
    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    await prisma.concert.update({
      where: { id: concertId },
      data: { ticketInputClosedAt: null },
    });

    return c.json({ data: { ticketInputClosedAt: null } });
  });
