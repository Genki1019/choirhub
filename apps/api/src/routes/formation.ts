import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hasRole } from "../services/access.js";
import { applySurveyToOnStage } from "../services/onstage.js";
import type { TenantEnv } from "../middleware/tenant.js";

// concertId が指定org配下の演奏会かを解決する（このファイルの各エンドポイント共通の存在確認）
async function resolveConcertInOrg(orgId: string, concertId: string) {
  const concert = await prisma.concert.findUnique({ where: { id: concertId } });
  return concert && concert.orgId === orgId ? concert : null;
}

// patternId が指定ステージ配下のフォーメーションパターンかを解決する
async function resolveFormationPattern(stageId: string, patternId: string) {
  const pattern = await prisma.formationPattern.findUnique({ where: { id: patternId } });
  return pattern && pattern.stageId === stageId ? pattern : null;
}

export const formationRouter = new Hono<TenantEnv>()

  // ── POST /concerts/:concertId/surveys/:surveyId/apply ── 指定した調査の回答をオンステ確定に反映（tech+）
  // 調査が複数（一次・二次など）ある場合に、どの調査を反映するかを明示的に選べるようにする。
  // 開閉状態にかかわらず呼び出せる（締切時の自動反映とは独立）。
  .post(
    "/concerts/:concertId/surveys/:surveyId/apply",
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId, surveyId } = c.req.param();
      const concert = await resolveConcertInOrg(org.id, concertId);
      if (!concert) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const survey = await prisma.concertSurvey.findUnique({ where: { id: surveyId } });
      if (!survey || survey.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "調査が見つかりません" } }, 404);
      }

      await applySurveyToOnStage(concertId, surveyId);

      return c.json({ data: { ok: true } });
    }
  )

  // ── POST /concerts/:concertId/stages/:stageId/formation-patterns ── フォーメーションパターン作成（tech+）
  .post(
    "/concerts/:concertId/stages/:stageId/formation-patterns",
    zValidator("json", z.object({
      name: z.string().min(1),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId, stageId } = c.req.param();
      const concert = await resolveConcertInOrg(org.id, concertId);
      if (!concert) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const stage = await prisma.stage.findUnique({ where: { id: stageId } });
      if (!stage || stage.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "ステージが見つかりません" } }, 404);
      }

      const { name } = c.req.valid("json");

      const maxOrder = await prisma.formationPattern.aggregate({ where: { stageId }, _max: { sortOrder: true } });
      // 指揮・ピアノは常に1件ずつ存在する固定枠として、パターン作成と同時に用意する
      const pattern = await prisma.formationPattern.create({
        data: {
          stageId,
          name,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
          boxes: {
            create: [
              { kind: "conductor", sortOrder: 1 },
              { kind: "piano", sortOrder: 2 },
            ],
          },
        },
        include: { boxes: true },
      });

      return c.json({
        data: {
          id: pattern.id, name: pattern.name, sortOrder: pattern.sortOrder,
          isStaggered: pattern.isStaggered, pianoPosition: pattern.pianoPosition,
          boxes: pattern.boxes.map((box) => ({ id: box.id, kind: box.kind, title: box.title, sortOrder: box.sortOrder })),
          slots: [],
        },
      }, 201);
    }
  )

  // ── PATCH /concerts/:concertId/stages/:stageId/formation-patterns/:patternId ── 名称・ずらし設定・ピアノ位置の変更（tech+）
  .patch(
    "/concerts/:concertId/stages/:stageId/formation-patterns/:patternId",
    zValidator("json", z.object({
      name: z.string().min(1).optional(),
      isStaggered: z.boolean().optional(),
      pianoPosition: z.enum(["center", "kamite"]).optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId, stageId, patternId } = c.req.param();
      const concert = await resolveConcertInOrg(org.id, concertId);
      if (!concert) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const pattern = await resolveFormationPattern(stageId, patternId);
      if (!pattern) {
        return c.json({ error: { code: "NOT_FOUND", message: "パターンが見つかりません" } }, 404);
      }

      const { name, isStaggered, pianoPosition } = c.req.valid("json");
      const updated = await prisma.formationPattern.update({ where: { id: patternId }, data: { name, isStaggered, pianoPosition } });

      return c.json({ data: { id: updated.id, name: updated.name, sortOrder: updated.sortOrder, isStaggered: updated.isStaggered, pianoPosition: updated.pianoPosition } });
    }
  )

  // ── DELETE /concerts/:concertId/stages/:stageId/formation-patterns/:patternId ── パターン削除（tech+）
  .delete(
    "/concerts/:concertId/stages/:stageId/formation-patterns/:patternId",
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId, stageId, patternId } = c.req.param();
      const concert = await resolveConcertInOrg(org.id, concertId);
      if (!concert) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const pattern = await resolveFormationPattern(stageId, patternId);
      if (!pattern) {
        return c.json({ error: { code: "NOT_FOUND", message: "パターンが見つかりません" } }, 404);
      }

      await prisma.formationPattern.delete({ where: { id: patternId } });

      return new Response(null, { status: 204 });
    }
  )

  // ── PUT /concerts/:concertId/stages/:stageId/formation-patterns/order ── パターン並び替え（tech+）
  .put(
    "/concerts/:concertId/stages/:stageId/formation-patterns/order",
    zValidator("json", z.object({
      ids: z.array(z.string()).min(1),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId, stageId } = c.req.param();
      const concert = await resolveConcertInOrg(org.id, concertId);
      if (!concert) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { ids } = c.req.valid("json");

      const patterns = await prisma.formationPattern.findMany({ where: { stageId }, select: { id: true } });
      const validIds = new Set(patterns.map((p) => p.id));
      if (ids.some((id) => !validIds.has(id))) {
        return c.json({ error: { code: "BAD_REQUEST", message: "このステージに属さないパターンが含まれています" } }, 400);
      }

      await Promise.all(ids.map((id, i) => prisma.formationPattern.update({ where: { id }, data: { sortOrder: i + 1 } })));

      return new Response(null, { status: 204 });
    }
  )

  // ── PUT /concerts/:concertId/stages/:stageId/formation-patterns/:patternId/slots ── 枠・スロットの一括保存（tech+）
  .put(
    "/concerts/:concertId/stages/:stageId/formation-patterns/:patternId/slots",
    zValidator("json", z.object({
      boxes: z.array(
        z.object({
          clientId:  z.string().min(1),
          kind:      z.enum(["conductor", "piano", "custom"]),
          title:     z.string().min(1).optional(),
          sortOrder: z.number().int().min(1),
        })
      ).max(50),
      slots: z.array(
        z.object({
          memberId:      z.string().optional(),
          label:         z.string().min(1).optional(),
          boxClientId:   z.string().optional(),
          rowNum:        z.number().int().min(1).optional(),
          positionOrder: z.number().int().min(1),
        })
          .refine((s) => s.memberId != null || s.label != null, {
            message: "memberId と label のどちらかは指定してください",
          })
          .refine((s) => (s.boxClientId != null) !== (s.rowNum != null), {
            message: "boxClientId と rowNum はどちらか一方だけ指定してください",
          })
      ).max(300),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId, stageId, patternId } = c.req.param();
      const concert = await resolveConcertInOrg(org.id, concertId);
      if (!concert) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const pattern = await resolveFormationPattern(stageId, patternId);
      if (!pattern) {
        return c.json({ error: { code: "NOT_FOUND", message: "パターンが見つかりません" } }, 404);
      }

      const { boxes, slots } = c.req.valid("json");

      const memberIds = slots.map((s) => s.memberId).filter((id): id is string => id != null);
      if (memberIds.length > 0) {
        const members = await prisma.member.findMany({ where: { orgId: org.id, id: { in: memberIds } }, select: { id: true } });
        const validMemberIds = new Set(members.map((m) => m.id));
        if (memberIds.some((id) => !validMemberIds.has(id))) {
          return c.json({ error: { code: "BAD_REQUEST", message: "この団体に属さないメンバーが含まれています" } }, 400);
        }

        const onAssignments = await prisma.onStageAssignment.findMany({
          where: { concertId, stageId, memberId: { in: memberIds }, status: "on" },
          select: { memberId: true },
        });
        const onMemberIds = new Set(onAssignments.map((a) => a.memberId));
        if (memberIds.some((id) => !onMemberIds.has(id))) {
          return c.json({ error: { code: "BAD_REQUEST", message: "このステージでオンステ確定していないメンバーが含まれています" } }, 400);
        }
      }

      const boxClientIds = new Set(boxes.map((b) => b.clientId));
      if (slots.some((s) => s.boxClientId != null && !boxClientIds.has(s.boxClientId))) {
        return c.json({ error: { code: "BAD_REQUEST", message: "存在しない枠を参照しているスロットがあります" } }, 400);
      }

      await prisma.$transaction(async (tx) => {
        await tx.formationSlot.deleteMany({ where: { patternId } });
        await tx.formationBox.deleteMany({ where: { patternId } });

        const createdBoxes = await Promise.all(
          boxes.map((b) =>
            tx.formationBox.create({
              data: { patternId, kind: b.kind, title: b.title ?? null, sortOrder: b.sortOrder },
            })
          )
        );
        const clientIdToRealId = new Map(boxes.map((b, i) => [b.clientId, createdBoxes[i].id]));

        if (slots.length > 0) {
          await tx.formationSlot.createMany({
            data: slots.map((s) => ({
              patternId,
              memberId:      s.memberId ?? null,
              label:         s.label ?? null,
              boxId:         s.boxClientId ? clientIdToRealId.get(s.boxClientId) : null,
              rowNum:        s.rowNum ?? null,
              positionOrder: s.positionOrder,
            })),
          });
        }
      });

      return new Response(null, { status: 204 });
    }
  );
