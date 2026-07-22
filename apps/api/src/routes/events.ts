import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, hasRole, isHiddenRole, EXCLUDE_HIDDEN_ROLES } from "../services/access.js";
import type { TenantEnv } from "../middleware/tenant.js";
import type { Event, EventCategory, Member } from "../generated/prisma/index.js";
import { Prisma } from "../generated/prisma/index.js";

// ────────────────────────────
// 招待判定ヘルパー
// ────────────────────────────

function isInvited(member: Member, event: Event): boolean {
  const roleMatch =
    event.targetRoles.length === 0 || event.targetRoles.some((r) => member.roles.includes(r));

  const partMatch =
    event.targetPartIds.length === 0 ||
    (member.partId !== null && event.targetPartIds.includes(member.partId));

  return roleMatch && partMatch;
}

// ────────────────────────────
// バリデーションスキーマ
// ────────────────────────────

const notesField = z.string().max(2000).optional().nullable();

const eventBodySchema = z.object({
  title: z.string().min(1),
  categoryId: z.string().cuid(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  location: z.string().optional().nullable(),
  locationUrl: z.string().url().optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  rehearsalContent: notesField,
  timeSchedule: notesField,
  practiceVenue: notesField,
  otherNotes: notesField,
  targetRoles: z.array(z.string()).optional().nullable(),
  targetPartIds: z.array(z.string()).optional().nullable(),
});

const attendanceBodySchema = z.object({
  status: z.enum(["attending", "absent", "maybe", "undecided"]),
  arriveTime: z.string().optional().nullable(),
  leaveTime: z.string().optional().nullable(),
  dayMemo: z.string().optional().nullable(),
});

// ────────────────────────────
// レスポンス整形
// ────────────────────────────

function formatEvent(event: Event & { concertId?: string | null; category: EventCategory }) {
  return {
    id: event.id,
    title: event.title,
    category: {
      id: event.category.id,
      name: event.category.name,
      slug: event.category.slug,
      color: event.category.color,
    },
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    location: event.location,
    locationUrl: event.locationUrl,
    deadline: event.deadline?.toISOString() ?? null,
    rehearsalContent: event.rehearsalContent,
    timeSchedule: event.timeSchedule,
    practiceVenue: event.practiceVenue,
    otherNotes: event.otherNotes,
    isLocked: event.isLocked,
    targetRoles: event.targetRoles.length > 0 ? event.targetRoles : null,
    targetPartIds: event.targetPartIds.length > 0 ? event.targetPartIds : null,
    concertId: event.concertId ?? null,
  };
}

// ────────────────────────────
// Router
// ────────────────────────────

export const eventsRouter = new Hono<TenantEnv>()

  // ── GET /events ──────────────────────────────────────────────────────────
  // イベント一覧 + Concert テーブル（linkedEvent のない本番）をマージして返す
  .get("/events", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { from, to, type } = c.req.query();

    if (from && isNaN(Date.parse(from))) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "from パラメータの日付形式が不正です" } },
        400,
      );
    }
    if (to && isNaN(Date.parse(to))) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "to パラメータの日付形式が不正です" } },
        400,
      );
    }

    const dateRange =
      from || to
        ? {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          }
        : undefined;

    const where: Prisma.EventWhereInput = { orgId: org.id };
    if (dateRange) where.startsAt = dateRange;
    if (type) {
      const cat = await prisma.eventCategory.findFirst({ where: { orgId: org.id, slug: type } });
      if (!cat) return c.json({ data: [] });
      where.categoryId = cat.id;
    }

    const events = await prisma.event.findMany({
      where,
      include: { category: true },
      orderBy: { startsAt: "asc" },
    });

    const visible = isAdmin(member) ? events : events.filter((ev) => isInvited(member, ev));

    const myAttendances = await prisma.attendance.findMany({
      where: { memberId: member.id, eventId: { in: visible.map((e) => e.id) } },
    });
    const attMap = new Map(myAttendances.map((a) => [a.eventId, a.status]));

    const eventItems = visible.map((ev) => ({
      ...formatEvent(ev),
      myAttendance: (attMap.get(ev.id) ?? "undecided") as string,
    }));

    // Concert テーブル: linkedEvent のないもの（= スケジュールと紐付いていない直接登録分）のみ追加
    const includeConcerts = !type || type === "concert";
    const concertItems: typeof eventItems = [];

    if (includeConcerts) {
      const concertWhere: Prisma.ConcertWhereInput = {
        orgId: org.id,
        linkedEvent: null,
      };
      if (dateRange) concertWhere.heldOn = dateRange;

      const [concerts, concertCategory] = await Promise.all([
        prisma.concert.findMany({ where: concertWhere, orderBy: { heldOn: "asc" } }),
        prisma.eventCategory.findFirst({ where: { orgId: org.id, slug: "concert" } }),
      ]);

      const myOnStage = await prisma.onStageAssignment.findMany({
        where: { concertId: { in: concerts.map((ct) => ct.id) }, memberId: member.id },
        select: { concertId: true },
      });
      const onStageSet = new Set(myOnStage.map((a) => a.concertId));

      const catFallback = concertCategory ?? {
        id: "",
        name: "本番",
        slug: "concert",
        color: "#F97316",
      };

      for (const ct of concerts) {
        concertItems.push({
          id: ct.id,
          title: ct.title,
          category: {
            id: catFallback.id,
            name: catFallback.name,
            slug: catFallback.slug,
            color: catFallback.color,
          },
          startsAt: ct.heldOn.toISOString(),
          endsAt: ct.heldOn.toISOString(),
          location: ct.venue ?? null,
          locationUrl: null,
          deadline: null,
          rehearsalContent: null,
          timeSchedule: null,
          practiceVenue: null,
          otherNotes: null,
          isLocked: false,
          targetRoles: null,
          targetPartIds: null,
          concertId: ct.id,
          myAttendance: onStageSet.has(ct.id) ? "attending" : "undecided",
        });
      }
    }

    const merged = [...eventItems, ...concertItems].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

    return c.json({ data: merged });
  })

  // ── POST /events ─────────────────────────────────────────────────────────
  // イベントを作成する。eventType=concert の場合は Concert も自動生成する。
  .post(
    "/events",
    zValidator("json", eventBodySchema, (r, c) => {
      if (!r.success)
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");

      if (!hasRole(member, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const body = c.req.valid("json");

      const selectedCategory = await prisma.eventCategory.findUnique({
        where: { id: body.categoryId },
      });
      if (!selectedCategory || selectedCategory.orgId !== org.id) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "イベント区分が見つかりません" } },
          404,
        );
      }

      const eventData = {
        orgId: org.id,
        title: body.title,
        categoryId: body.categoryId,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        location: body.location ?? null,
        locationUrl: body.locationUrl ?? null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        rehearsalContent: body.rehearsalContent ?? null,
        timeSchedule: body.timeSchedule ?? null,
        practiceVenue: body.practiceVenue ?? null,
        otherNotes: body.otherNotes ?? null,
        targetRoles: body.targetRoles ?? [],
        targetPartIds: body.targetPartIds ?? [],
      };

      if (selectedCategory.slug === "concert") {
        const concert = await prisma.concert.create({
          data: {
            orgId: org.id,
            title: body.title,
            heldOn: new Date(body.startsAt),
            venue: body.location ?? null,
          },
        });
        await prisma.event.create({
          data: { ...eventData, concertId: concert.id },
        });
        const result = await prisma.event.findFirst({
          where: { concertId: concert.id },
          include: { category: true },
        });
        return c.json({ data: formatEvent(result!) }, 201);
      }

      const ev = await prisma.event.create({ data: eventData });

      // per_rehearsal モードの練習イベントは徴収を自動生成
      if (
        selectedCategory.slug === "rehearsal" &&
        org.feeType === "per_rehearsal" &&
        org.defaultFeeAmount
      ) {
        const activeMembers = await prisma.member.findMany({
          where: { orgId: org.id, status: "active", ...EXCLUDE_HIDDEN_ROLES },
          select: { id: true, memberType: { select: { defaultFeeAmount: true } } },
        });
        if (activeMembers.length > 0) {
          const collection = await prisma.collection.create({
            data: {
              orgId: org.id,
              title: `${body.title} 場所代`,
              amount: org.defaultFeeAmount,
              eventId: ev.id,
              createdById: member.id,
            },
          });
          for (const m of activeMembers) {
            await prisma.collectionPayment.create({
              data: {
                collectionId: collection.id,
                memberId: m.id,
                status: "pending",
                amount:
                  m.memberType?.defaultFeeAmount != null &&
                  m.memberType.defaultFeeAmount !== org.defaultFeeAmount
                    ? m.memberType.defaultFeeAmount
                    : null,
              },
            });
          }
        }
      }

      const event = await prisma.event.findUnique({
        where: { id: ev.id },
        include: { category: true },
      });
      return c.json({ data: formatEvent(event!) }, 201);
    },
  )

  // ── GET /events/:id ───────────────────────────────────────────────────────
  .get("/events/:id", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { id } = c.req.param();

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        category: true,
        attendances: {
          include: {
            member: { include: { userRef: true, part: true } },
          },
        },
      },
    });

    if (!event || event.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
    }

    if (!isAdmin(member) && !isInvited(member, event)) {
      return c.json(
        { error: { code: "NOT_INVITED", message: "このイベントへの参加権限がありません" } },
        403,
      );
    }

    const invitedAttendances = (
      isAdmin(member)
        ? event.attendances
        : event.attendances.filter((a) => isInvited(a.member, event))
    ).filter((a) => !isHiddenRole(a.member));

    const summary = { attending: 0, absent: 0, maybe: 0, undecided: 0 };
    invitedAttendances.forEach((a) => {
      summary[a.status]++;
    });

    return c.json({
      data: {
        ...formatEvent(event),
        invitedCount: invitedAttendances.length,
        attendances: invitedAttendances.map((a) => ({
          member: {
            id: a.member.id,
            nameJa: a.member.userRef.nameJa,
            part: a.member.part
              ? {
                  id: a.member.part.id,
                  name: a.member.part.name,
                  sortOrder: a.member.part.sortOrder,
                  voiceType: a.member.part.voiceType,
                }
              : null,
          },
          status: a.status,
          arriveTime: a.arriveTime,
          leaveTime: a.leaveTime,
          dayMemo: a.dayMemo,
        })),
        summary,
      },
    });
  })

  // ── PATCH /events/:id ─────────────────────────────────────────────────────
  // Concert とリンクしている場合は Concert も同期更新する
  .patch(
    "/events/:id",
    zValidator("json", eventBodySchema.partial(), (r, c) => {
      if (!r.success)
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { id } = c.req.param();

      if (!hasRole(member, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const event = await prisma.event.findUnique({ where: { id } });
      if (!event || event.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      await prisma.event.update({
        where: { id, orgId: org.id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
          ...(body.startsAt !== undefined && { startsAt: new Date(body.startsAt) }),
          ...(body.endsAt !== undefined && { endsAt: new Date(body.endsAt) }),
          ...(body.location !== undefined && { location: body.location }),
          ...(body.locationUrl !== undefined && { locationUrl: body.locationUrl }),
          ...(body.deadline !== undefined && {
            deadline: body.deadline ? new Date(body.deadline) : null,
          }),
          ...(body.rehearsalContent !== undefined && {
            rehearsalContent: body.rehearsalContent,
          }),
          ...(body.timeSchedule !== undefined && { timeSchedule: body.timeSchedule }),
          ...(body.practiceVenue !== undefined && { practiceVenue: body.practiceVenue }),
          ...(body.otherNotes !== undefined && { otherNotes: body.otherNotes }),
          ...(body.targetRoles !== undefined && { targetRoles: body.targetRoles ?? [] }),
          ...(body.targetPartIds !== undefined && { targetPartIds: body.targetPartIds ?? [] }),
        },
      });

      if (event.concertId) {
        await prisma.concert.update({
          where: { id: event.concertId, orgId: org.id },
          data: {
            ...(body.title !== undefined && { title: body.title }),
            ...(body.startsAt !== undefined && { heldOn: new Date(body.startsAt) }),
            ...(body.location !== undefined && { venue: body.location }),
          },
        });
      }

      const updated = await prisma.event.findUnique({ where: { id }, include: { category: true } });
      return c.json({ data: formatEvent(updated!) });
    },
  )

  // ── DELETE /events/:id ────────────────────────────────────────────────────
  // Concert とリンクしている場合は Concert も削除する
  .delete("/events/:id", async (c) => {
    const org = c.get("org");
    const member = c.get("member");
    const { id } = c.req.param();

    if (!hasRole(member, "tech")) {
      return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event || event.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
    }

    await prisma.event.delete({ where: { id } });
    if (event.concertId) {
      await prisma.concert.delete({ where: { id: event.concertId } });
    }

    return new Response(null, { status: 204 });
  })

  // ── PUT /events/:id/attendance/me ─────────────────────────────────────────
  .put(
    "/events/:id/attendance/me",
    zValidator("json", attendanceBodySchema, (r, c) => {
      if (!r.success)
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { id } = c.req.param();

      const event = await prisma.event.findUnique({ where: { id } });
      if (!event || event.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
      }

      if (!isAdmin(member) && !isInvited(member, event)) {
        return c.json(
          { error: { code: "NOT_INVITED", message: "このイベントへの参加権限がありません" } },
          403,
        );
      }

      if (event.isLocked) {
        return c.json({ error: { code: "LOCKED", message: "出欠の締切が過ぎています" } }, 403);
      }

      const body = c.req.valid("json");

      const attendance = await prisma.attendance.upsert({
        where: { eventId_memberId: { eventId: id, memberId: member.id } },
        create: { eventId: id, memberId: member.id, ...body },
        update: { ...body },
      });

      return c.json({
        data: {
          status: attendance.status,
          arriveTime: attendance.arriveTime,
          leaveTime: attendance.leaveTime,
          dayMemo: attendance.dayMemo,
          updatedAt: attendance.updatedAt.toISOString(),
        },
      });
    },
  )

  // ── PATCH /events/:id/attendance/:memberId ────────────────────────────────
  .patch(
    "/events/:id/attendance/:memberId",
    zValidator("json", attendanceBodySchema.partial(), (r, c) => {
      if (!r.success)
        return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const org = c.get("org");
      const member = c.get("member");
      const { id, memberId } = c.req.param();

      if (!isAdmin(member)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ操作できます" } }, 403);
      }

      const event = await prisma.event.findUnique({ where: { id } });
      if (!event || event.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "イベントが見つかりません" } }, 404);
      }

      const target = await prisma.member.findUnique({ where: { id: memberId } });
      if (!target || target.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      const attendance = await prisma.attendance.upsert({
        where: { eventId_memberId: { eventId: id, memberId } },
        create: { eventId: id, memberId, status: "undecided", ...body },
        update: { ...body },
      });

      return c.json({
        data: {
          status: attendance.status,
          arriveTime: attendance.arriveTime,
          leaveTime: attendance.leaveTime,
          dayMemo: attendance.dayMemo,
          updatedAt: attendance.updatedAt.toISOString(),
        },
      });
    },
  );
