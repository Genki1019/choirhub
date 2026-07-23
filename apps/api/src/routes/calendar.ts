import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import ical from "ical-generator";
import { prisma } from "../lib/prisma.js";
import { getScheduleItems, type ScheduleItem } from "./events.js";
import type { TenantEnv } from "../middleware/tenant.js";

function formatDescription(item: ScheduleItem): string | undefined {
  const sections: Array<[string, string | null]> = [
    ["練習内容", item.rehearsalContent],
    ["タイムスケジュール", item.timeSchedule],
    ["練習会場", item.practiceVenue],
    ["その他", item.otherNotes],
  ];

  const text = sections
    .filter((s): s is [string, string] => s[1] !== null)
    .map(([label, value]) => `【${label}】\n${value}`)
    .join("\n\n");

  return text || undefined;
}

// ────────────────────────────
// Router（ログイン必須・/:orgSlug/* 配下）
// ────────────────────────────

export const calendarRouter = new Hono<TenantEnv>()

  // ── GET /calendar-feed-token ─────────────────────────────────────────────
  .get("/calendar-feed-token", async (c) => {
    const member = c.get("member");
    return c.json({ data: { token: member.calendarFeedToken } });
  })

  // ── POST /calendar-feed-token/regenerate ─────────────────────────────────
  .post("/calendar-feed-token/regenerate", async (c) => {
    const member = c.get("member");
    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { calendarFeedToken: randomUUID() },
    });
    return c.json({ data: { token: updated.calendarFeedToken } });
  });

// ────────────────────────────
// 公開iCalフィード（認証Cookie不要。tokenが認証情報）
// ────────────────────────────

export async function handleCalendarFeed(c: Context): Promise<Response> {
  const orgSlug = c.req.param("orgSlug");
  const token = c.req.query("token");

  if (!token) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "token が指定されていません" } },
      400,
    );
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    return c.json({ error: { code: "NOT_FOUND", message: "団体が見つかりません" } }, 404);
  }

  const member = await prisma.member.findFirst({
    where: { orgId: org.id, calendarFeedToken: token, deletedAt: null },
  });
  if (!member) {
    return c.json({ error: { code: "NOT_FOUND", message: "無効なURLです" } }, 404);
  }

  const items = await getScheduleItems(org.id, member);

  const calendar = ical({ name: `${org.name} スケジュール` });
  for (const item of items) {
    calendar.createEvent({
      id: item.id,
      start: new Date(item.startsAt),
      end: new Date(item.endsAt),
      summary: item.title,
      location: item.location ?? undefined,
      description: formatDescription(item),
      categories: [{ name: item.category.name }],
    });
  }

  return new Response(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
