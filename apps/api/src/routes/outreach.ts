import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isMemberPlus, isTicketManager } from "../services/access.js";
import type { TenantEnv } from "../middleware/tenant.js";

export const outreachRouter = new Hono<TenantEnv>()

  // GET /tickets/:concertId/outreach
  .get("/tickets/:concertId/outreach", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId } = c.req.param();

    const concert = await prisma.concert.findFirst({
      where: { id: concertId, orgId: org.id },
    });
    if (!concert)
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);

    const activities = await prisma.outreachActivity.findMany({
      where: { concertId, concert: { orgId: org.id } },
      orderBy: { activityDate: "desc" },
      include: {
        creator: { select: { id: true, userRef: { select: { nameJa: true } } } },
        participants: {
          include: {
            member: {
              select: {
                id: true,
                partId: true,
                userRef: { select: { nameJa: true } },
                part: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!isTicketManager(actingMember)) {
      const filtered = activities.filter(
        (a) =>
          a.createdById === actingMember.id ||
          a.participants.some((p) => p.memberId === actingMember.id),
      );
      return c.json({ data: filtered.map(formatActivity) });
    }

    return c.json({ data: activities.map(formatActivity) });
  })

  // POST /tickets/:concertId/outreach
  .post(
    "/tickets/:concertId/outreach",
    zValidator(
      "json",
      z.object({
        destination: z.string().min(1),
        activityDate: z.string().date(),
        note: z.string().optional(),
        participants: z
          .array(
            z.object({
              memberId: z.string(),
              ticketsSold: z.number().int().min(0).default(0),
              expense: z.number().int().min(0).optional(),
            }),
          )
          .min(1),
      }),
      (result, c) => {
        if (!result.success)
          return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      },
    ),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { concertId } = c.req.param();
      const body = c.req.valid("json");

      if (!isMemberPlus(actingMember)) {
        return c.json(
          { error: { code: "FORBIDDEN", message: "情宣記録の申請は一般団員以上のみ可能です" } },
          403,
        );
      }

      if (!isTicketManager(actingMember)) {
        const includesSelf = body.participants.some((p) => p.memberId === actingMember.id);
        if (!includesSelf) {
          return c.json(
            { error: { code: "FORBIDDEN", message: "自分を参加者に含めてください" } },
            403,
          );
        }
      }

      const concert = await prisma.concert.findFirst({
        where: { id: concertId, orgId: org.id },
      });
      if (!concert)
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);

      const memberIds = body.participants.map((p) => p.memberId);
      const validMembers = await prisma.member.findMany({
        where: { id: { in: memberIds }, orgId: org.id },
        select: { id: true },
      });
      if (validMembers.length !== memberIds.length) {
        return c.json(
          {
            error: {
              code: "INVALID_MEMBER",
              message: "この団体に属さないメンバーが含まれています",
            },
          },
          400,
        );
      }

      const activity = await prisma.outreachActivity.create({
        data: {
          concertId,
          destination: body.destination,
          activityDate: new Date(body.activityDate),
          note: body.note,
          createdById: actingMember.id,
          participants: {
            create: body.participants.map((p) => ({
              memberId: p.memberId,
              ticketsSold: p.ticketsSold,
              expense: p.expense ?? null,
            })),
          },
        },
        include: {
          creator: { select: { id: true, userRef: { select: { nameJa: true } } } },
          participants: {
            include: {
              member: {
                select: {
                  id: true,
                  partId: true,
                  userRef: { select: { nameJa: true } },
                  part: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      return c.json({ data: formatActivity(activity) }, 201);
    },
  )

  // PATCH /tickets/:concertId/outreach/:activityId/pay
  .patch("/tickets/:concertId/outreach/:activityId/pay", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId, activityId } = c.req.param();

    if (!isTicketManager(actingMember)) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "チケット担当者または管理者のみ操作できます" } },
        403,
      );
    }

    const concert = await prisma.concert.findFirst({
      where: { id: concertId, orgId: org.id },
    });
    if (!concert)
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);

    const activity = await prisma.outreachActivity.findFirst({
      where: { id: activityId, concertId, concert: { orgId: org.id } },
    });
    if (!activity)
      return c.json({ error: { code: "NOT_FOUND", message: "情宣活動が見つかりません" } }, 404);

    const updated = await prisma.outreachActivity.update({
      where: { id: activityId },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
      include: {
        creator: { select: { id: true, userRef: { select: { nameJa: true } } } },
        participants: {
          include: {
            member: {
              select: {
                id: true,
                partId: true,
                userRef: { select: { nameJa: true } },
                part: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return c.json({ data: formatActivity(updated) });
  })

  // DELETE /tickets/:concertId/outreach/:activityId
  .delete("/tickets/:concertId/outreach/:activityId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId, activityId } = c.req.param();

    const concert = await prisma.concert.findFirst({
      where: { id: concertId, orgId: org.id },
    });
    if (!concert)
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);

    const activity = await prisma.outreachActivity.findFirst({
      where: { id: activityId, concertId, concert: { orgId: org.id } },
    });
    if (!activity)
      return c.json({ error: { code: "NOT_FOUND", message: "情宣活動が見つかりません" } }, 404);

    if (activity.createdById !== actingMember.id && !isTicketManager(actingMember)) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "申請者またはチケット担当者・管理者のみ削除できます",
          },
        },
        403,
      );
    }

    await prisma.outreachActivity.delete({ where: { id: activityId, concertId } });
    return new Response(null, { status: 204 });
  });

type ActivityWithRelations = Awaited<ReturnType<typeof prisma.outreachActivity.findFirst>> & {
  creator: { id: string; userRef: { nameJa: string } };
  participants: Array<{
    id: string;
    activityId: string;
    memberId: string;
    ticketsSold: number;
    expense: number | null;
    member: {
      id: string;
      partId: string | null;
      userRef: { nameJa: string };
      part: { name: string } | null;
    };
  }>;
};

function formatActivity(a: ActivityWithRelations) {
  return {
    id: a!.id,
    concertId: a!.concertId,
    destination: a!.destination,
    activityDate: a!.activityDate,
    note: a!.note,
    status: a!.status,
    paidAt: a!.paidAt,
    createdBy: a!.createdById,
    creatorName: a!.creator.userRef.nameJa,
    createdAt: a!.createdAt,
    participants: a!.participants.map((p) => ({
      id: p.id,
      memberId: p.memberId,
      memberName: p.member.userRef.nameJa,
      partId: p.member.partId,
      partName: p.member.part?.name ?? null,
      ticketsSold: p.ticketsSold,
      expense: p.expense,
    })),
  };
}
