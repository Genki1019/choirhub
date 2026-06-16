import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { TenantEnv } from "../middleware/tenant.js";
import { isAdmin, isVisitor, isTicketManager } from "../services/access.js";

export const homeRouter = new Hono<TenantEnv>()
  .get("/home", async (c) => {
    const org    = c.get("org");
    const member = c.get("member");
    const orgId  = org.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isVisitorMember = isVisitor(member);

    const [upcomingRaw, recentMailsRaw] = await Promise.all([
      prisma.event.findMany({
        where: { orgId, startsAt: { gte: today } },
        orderBy: { startsAt: "asc" },
        include: {
          category: true,
          attendances: {
            where: { memberId: member.id },
            select: { status: true },
          },
        },
      }),
      isVisitorMember
        ? Promise.resolve([])
        : prisma.mailLog.findMany({
            where: { orgId },
            orderBy: { sentAt: "desc" },
            take: 3,
            select: {
              id: true, subject: true, sentAt: true,
              sentBy: { select: { userRef: { select: { nameJa: true } } } },
            },
          }),
    ]);

    const visibleEvents = isAdmin(member)
      ? upcomingRaw
      : upcomingRaw.filter((e) => {
          const roleOk = e.targetRoles.length === 0 || e.targetRoles.some((r) => member.roles.includes(r));
          const partOk = e.targetPartIds.length === 0 || (member.partId !== null && e.targetPartIds.includes(member.partId));
          return roleOk && partOk;
        });

    const unansweredEventCount = visibleEvents.filter(
      (e) => (e.attendances[0]?.status ?? "undecided") === "undecided"
    ).length;

    const mapEvent = (e: (typeof upcomingRaw)[0]) => ({
      id: e.id,
      title: e.title,
      category: { id: e.category.id, name: e.category.name, slug: e.category.slug, color: e.category.color },
      startsAt: e.startsAt.toISOString(),
      location: e.location,
      concertId: e.concertId,
      myAttendance: e.attendances[0]?.status ?? "undecided",
    });

    const upcomingEvents   = visibleEvents.slice(0, 3).map(mapEvent);
    const nextRehearsalRaw = visibleEvents.find((e) => e.category.slug === "rehearsal" || e.category.name === "練習");
    const nextConcertRaw   = visibleEvents.find((e) => e.category.slug === "concert"   || e.category.name === "本番");

    const canViewTickets = isTicketManager(member);

    return c.json({
      data: {
        upcomingEvents,
        nextRehearsal: nextRehearsalRaw ? mapEvent(nextRehearsalRaw) : null,
        nextConcert:   nextConcertRaw   ? mapEvent(nextConcertRaw)   : null,
        unansweredEventCount,
        recentMails: recentMailsRaw.map((m) => ({
          id: m.id,
          subject: m.subject,
          sentAt: m.sentAt.toISOString(),
          senderName: m.sentBy.userRef.nameJa,
        })),
        canViewTickets,
        monthlyOrganizer: org.monthlyOrganizer ?? null,
        isTicketManager: canViewTickets,
      },
    });
  })

  .patch(
    "/home/monthly-organizer",
    zValidator("json", z.object({
      partName: z.string().max(50).nullable(),
    }), (result, c) => {
      if (!result.success) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
      }
    }),
    async (c) => {
      const member = c.get("member");
      const org    = c.get("org");

      if (!isTicketManager(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "チケット担当または管理者のみ操作できます" } }, 403);
      }

      const { partName } = c.req.valid("json");

      await prisma.organization.update({
        where: { id: org.id },
        data: { monthlyOrganizer: partName },
      });

      return c.json({ data: { monthlyOrganizer: partName } });
    }
  );
