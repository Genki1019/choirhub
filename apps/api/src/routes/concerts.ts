import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, hasRole, isVisitor, isHiddenRole, EXCLUDE_HIDDEN_ROLES } from "../services/access.js";
import { syncOnStageFromResponses, applySurveyToOnStage } from "../services/onstage.js";
import type { TenantEnv } from "../middleware/tenant.js";

export const concertsRouter = new Hono<TenantEnv>()

  // ── POST /concerts ── 演奏会を新規作成（tech 以上）
  // スケジュールと連携するため、"concert" スラグのイベント区分を自動で探して Event も作成する
  .post(
    "/concerts",
    zValidator("json", z.object({
      title:         z.string().min(1),
      heldOn:        z.string().datetime({ offset: true }),
      endsAt:        z.string().datetime({ offset: true }).optional(),
      venue:         z.string().optional().nullable(),
      locationUrl:   z.string().optional().nullable(),
      targetRoles:   z.array(z.string()).optional().nullable(),
      targetPartIds: z.array(z.string()).optional().nullable(),
      deadline:      z.string().datetime({ offset: true }).optional().nullable(),
      pageMemo:      z.string().optional().nullable(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { title, heldOn, endsAt, venue, locationUrl, targetRoles, targetPartIds, deadline, pageMemo } = c.req.valid("json");

      const concert = await prisma.concert.create({
        data: { orgId: org.id, title, heldOn: new Date(heldOn), venue: venue ?? null },
      });

      // slug="concert" または name="本番" で既存のカテゴリを探す
      let concertCategory = await prisma.eventCategory.findFirst({
        where: { orgId: org.id, OR: [{ slug: "concert" }, { name: "本番" }] },
      });
      if (!concertCategory) {
        concertCategory = await prisma.eventCategory.create({
          data: { orgId: org.id, name: "本番", slug: "concert", color: "#EF4444", sortOrder: 2 },
        });
      }

      // スケジュールに表示するためのイベントを作成して Concert とリンク
      const linkedEvent = await prisma.event.create({
        data: {
          orgId:         org.id,
          title,
          categoryId:    concertCategory.id,
          startsAt:      new Date(heldOn),
          endsAt:        endsAt ? new Date(endsAt) : new Date(heldOn),
          location:      venue ?? null,
          locationUrl:   locationUrl ?? null,
          targetRoles:   targetRoles ?? [],
          targetPartIds: targetPartIds ?? [],
          deadline:      deadline ? new Date(deadline) : null,
          pageMemo:      pageMemo ?? null,
          concertId:     concert.id,
        },
      });

      return c.json({
        data: {
          id:             concert.id,
          title:          concert.title,
          heldOn:         concert.heldOn.toISOString(),
          venue:          concert.venue,
          status:         concert.status,
          stageCount:     0,
          programCount:   0,
          hasSurvey:      false,
          surveyOpen:     false,
          linkedEventId:  linkedEvent.id,
        },
      }, 201);
    }
  )

  // ── GET /concerts ── 一覧
  .get("/concerts", async (c) => {
    const org = c.get("org");

    const concerts = await prisma.concert.findMany({
      where: { orgId: org.id },
      orderBy: { heldOn: "asc" },
      include: {
        stages: { include: { programs: { select: { id: true } } } },
        concertSurveys: { select: { id: true, isOpen: true } },
        linkedEvent: { select: { id: true } },
      },
    });

    return c.json({
      data: concerts.map((ct) => ({
        id:           ct.id,
        title:        ct.title,
        heldOn:  ct.heldOn.toISOString(),
        venue:        ct.venue,
        status:       ct.status,
        stageCount:   ct.stages.length,
        programCount: ct.stages.reduce((n, s) => n + s.programs.length, 0),
        hasSurvey:    ct.concertSurveys.length > 0,
        surveyOpen:   ct.concertSurveys.some((s) => s.isOpen),
        linkedEventId: ct.linkedEvent?.id ?? null,
      })),
    });
  })

  // ── POST /concerts/:concertId/stages ── ステージを追加（admin のみ）
  .post(
    "/concerts/:concertId/stages",
    zValidator("json", z.object({
      name: z.string().min(1),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみステージを追加できます" } }, 403);
      }

      const { concertId } = c.req.param();

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { name } = c.req.valid("json");

      const maxStageOrder = await prisma.stage.aggregate({ where: { concertId }, _max: { sortOrder: true } });
      const stageSortOrder = (maxStageOrder._max.sortOrder ?? 0) + 1;
      const stage = await prisma.stage.create({ data: { concertId, name, sortOrder: stageSortOrder } });

      return c.json({
        data: {
          id: stage.id,
          name: stage.name,
          sortOrder: stage.sortOrder,
          programs: [],
        },
      }, 201);
    }
  )

  // ── PATCH /concerts/:concertId/stages/:stageId ── ステージ名更新（admin のみ）
  .patch(
    "/concerts/:concertId/stages/:stageId",
    zValidator("json", z.object({
      name: z.string().min(1),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ操作できます" } }, 403);
      }

      const { concertId, stageId } = c.req.param();
      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      // stageId がこの concert に属するか確認（IDOR防止）
      const existingStage = await prisma.stage.findUnique({ where: { id: stageId } });
      if (!existingStage || existingStage.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "ステージが見つかりません" } }, 404);
      }

      const { name } = c.req.valid("json");
      const stage = await prisma.stage.update({ where: { id: stageId }, data: { name } });

      return c.json({ data: { id: stage.id, name: stage.name, sortOrder: stage.sortOrder } });
    }
  )

  // ── PUT /concerts/:concertId/stages/order ── ステージ並び替え（admin のみ）
  .put(
    "/concerts/:concertId/stages/order",
    zValidator("json", z.object({
      ids: z.array(z.string()).min(1),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ操作できます" } }, 403);
      }

      const { concertId } = c.req.param();
      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { ids } = c.req.valid("json");

      // 送信された stageId がすべてこの concertId に属するか確認（IDOR防止）
      const stages = await prisma.stage.findMany({
        where: { concertId },
        select: { id: true },
      });
      const validStageIds = new Set(stages.map((s) => s.id));
      if (ids.some((id) => !validStageIds.has(id))) {
        return c.json({ error: { code: "BAD_REQUEST", message: "このコンサートに属さないステージが含まれています" } }, 400);
      }

      await Promise.all(ids.map((id, i) => prisma.stage.update({ where: { id }, data: { sortOrder: i + 1 } })));

      return new Response(null, { status: 204 });
    }
  )

  // ── PUT /concerts/:concertId/stages/:stageId/programs/order ── 曲目並び替え（admin のみ）
  .put(
    "/concerts/:concertId/stages/:stageId/programs/order",
    zValidator("json", z.object({
      ids: z.array(z.string()).min(1),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ操作できます" } }, 403);
      }

      const { concertId, stageId } = c.req.param();
      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { ids } = c.req.valid("json");

      // stageId がこの concert に属するか確認（IDOR防止）
      const targetStage = await prisma.stage.findUnique({ where: { id: stageId } });
      if (!targetStage || targetStage.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "ステージが見つかりません" } }, 404);
      }

      // 送信された programId がすべてこの stageId に属するか確認（IDOR防止）
      const programs = await prisma.program.findMany({
        where: { stageId },
        select: { id: true },
      });
      const validProgramIds = new Set(programs.map((p) => p.id));
      if (ids.some((id) => !validProgramIds.has(id))) {
        return c.json({ error: { code: "BAD_REQUEST", message: "このステージに属さない演目が含まれています" } }, 400);
      }

      await Promise.all(ids.map((id, i) => prisma.program.update({ where: { id }, data: { sortOrder: i + 1 } })));

      return new Response(null, { status: 204 });
    }
  )

  // ── POST /concerts/:concertId/stages/:stageId/programs ── 曲目を追加（admin のみ）
  .post(
    "/concerts/:concertId/stages/:stageId/programs",
    zValidator("json", z.object({
      scoreId:     z.string().optional(),
      title:       z.string().optional(),
      composer:    z.string().optional().nullable(),
      arranger:    z.string().optional().nullable(),
      accessLevel: z.enum(["secret", "restricted", "public"]).default("restricted"),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ曲目を追加できます" } }, 403);
      }

      const { concertId, stageId } = c.req.param();

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const stage = await prisma.stage.findUnique({ where: { id: stageId } });
      if (!stage || stage.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "ステージが見つかりません" } }, 404);
      }

      const { scoreId, title, composer, arranger, accessLevel } = c.req.valid("json");

      if (!scoreId && !title?.trim()) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "曲名またはscoreIdが必要です" } }, 400);
      }

      let responseScore: { id: string; composer: string | null; arranger: string | null };
      let program: { id: string; title: string; sortOrder: number };

      if (scoreId) {
        const existingScore = await prisma.score.findUnique({ where: { id: scoreId } });
        if (!existingScore || existingScore.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
        }
        const programTitle = title?.trim() || existingScore.title;
        const maxOrder1 = await prisma.program.aggregate({ where: { stageId }, _max: { sortOrder: true } });
        const sortOrder1 = (maxOrder1._max.sortOrder ?? 0) + 1;
        const updatedScore = await prisma.score.update({
          where: { id: scoreId },
          data: { ...(accessLevel ? { accessLevel } : {}) },
        });
        program = await prisma.program.create({ data: { stageId, scoreId, title: programTitle, sortOrder: sortOrder1 } });
        responseScore = { id: updatedScore.id, composer: updatedScore.composer, arranger: updatedScore.arranger };
      } else {
        const trimmedTitle = title!.trim();
        const maxOrder2 = await prisma.program.aggregate({ where: { stageId }, _max: { sortOrder: true } });
        const sortOrder2 = (maxOrder2._max.sortOrder ?? 0) + 1;
        const newScore = await prisma.score.create({
          data: { orgId: org.id, title: trimmedTitle, composer: composer ?? null, arranger: arranger ?? null, accessLevel },
        });
        program = await prisma.program.create({ data: { stageId, scoreId: newScore.id, title: trimmedTitle, sortOrder: sortOrder2 } });
        responseScore = { id: newScore.id, composer: newScore.composer, arranger: newScore.arranger };
      }

      return c.json({
        data: {
          id: program.id,
          title: program.title,
          sortOrder: program.sortOrder,
          score: responseScore,
        },
      }, 201);
    }
  )

  // ── DELETE /concerts/:concertId/programs/:programId ── 曲目を削除（admin のみ）
  .delete(
    "/concerts/:concertId/programs/:programId",
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ操作できます" } }, 403);
      }

      const { concertId, programId } = c.req.param();

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const program = await prisma.program.findUnique({
        where: { id: programId },
        include: { stage: { select: { concertId: true } } },
      });
      if (!program || program.stage.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "曲目が見つかりません" } }, 404);
      }

      await prisma.program.delete({ where: { id: programId, stageId: program.stageId } });

      return new Response(null, { status: 204 });
    }
  )

  // ── PATCH /concerts/:concertId/programs/:programId ── 曲目を編集（admin のみ）
  .patch(
    "/concerts/:concertId/programs/:programId",
    zValidator("json", z.object({
      title:    z.string().min(1).optional(),
      composer: z.string().nullable().optional(),
      arranger: z.string().nullable().optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
  
      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ操作できます" } }, 403);
      }

      const { concertId, programId } = c.req.param();

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const program = await prisma.program.findUnique({
        where: { id: programId },
        include: {
          stage: { select: { concertId: true } },
          score: { select: { id: true, composer: true, arranger: true } },
        },
      });
      if (!program || program.stage.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "曲目が見つかりません" } }, 404);
      }

      const { title, composer, arranger } = c.req.valid("json");

      if (title !== undefined) {
        await prisma.program.update({ where: { id: programId }, data: { title } });
      }

      let scoreData = program.score;
      if (program.scoreId && (composer !== undefined || arranger !== undefined)) {
        scoreData = await prisma.score.update({
          where: { id: program.scoreId },
          data: {
            ...(composer !== undefined ? { composer } : {}),
            ...(arranger !== undefined ? { arranger } : {}),
          },
          select: { id: true, composer: true, arranger: true },
        });
      }

      return c.json({
        data: {
          id:        programId,
          title:     title ?? program.title,
          sortOrder: program.sortOrder,
          score:     scoreData,
        },
      });
    }
  )

  // ── GET /concerts/structure ── 演奏会+ステージの軽量一覧（移動/コピー先選択用）
  .get("/concerts/structure", async (c) => {
    const org = c.get("org");
    const concerts = await prisma.concert.findMany({
      where: { orgId: org.id },
      orderBy: { heldOn: "asc" },
      select: {
        id: true,
        title: true,
        stages: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, sortOrder: true },
        },
      },
    });
    return c.json({ data: concerts });
  })

  // ── GET /concerts/:id ── 詳細
  .get("/concerts/:id", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    const concert = await prisma.concert.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { sortOrder: "asc" },
          include: {
            programs: {
              orderBy: { sortOrder: "asc" },
              include: {
                score: { select: { id: true, title: true, composer: true, arranger: true } },
              },
            },
            formationPatterns: {
              orderBy: { sortOrder: "asc" },
              include: {
                boxes: true,
                slots: {
                  include: {
                    member: {
                      include: {
                        userRef: { select: { nameJa: true } },
                        part: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        concertSurveys: {
          orderBy: { openAt: "desc" as const },
          select: {
            id:      true,
            title:   true,
            isOpen:  true,
            openAt:  true,
            closeAt: true,
            _count:  { select: { surveyResponses: true } },
          },
        },
        onStageAssignments: {
          include: {
            member: {
              include: {
                userRef: { select: { nameJa: true } },
                part: { select: { id: true, name: true, sortOrder: true, voiceType: true } },
              },
            },
          },
          orderBy: [
            { member: { part: { sortOrder: "asc" } } },
            { member: { userRef: { nameKana: "asc" } } },
            { member: { userRef: { nameJa: "asc" } } },
          ],
        },
        linkedEvent: { select: { id: true } },
      },
    });

    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    // visitor はステージ構成のみ返す（調査・オンステ不可）
    if (isVisitor(actingMember)) {
      return c.json({
        data: {
          id:          concert.id,
          title:       concert.title,
          heldOn: concert.heldOn.toISOString(),
          venue:       concert.venue,
          status:      concert.status,
          linkedEventId: concert.linkedEvent?.id ?? null,
          stages: concert.stages.map((stage) => ({
            id:        stage.id,
            name:      stage.name,
            sortOrder: stage.sortOrder,
            programs:  stage.programs.map((p) => ({
              id:        p.id,
              title:     p.title,
              sortOrder: p.sortOrder,
              score: p.score ? { id: p.score.id, composer: p.score.composer, arranger: p.score.arranger } : null,
            })),
          })),
          surveys:     [],
          assignments: [],
        },
      });
    }

    // オンステ確定（guest/visitor を除外）
    const assignments = concert.onStageAssignments.filter((a) => !isHiddenRole(a.member)).map((a) => ({
      memberId:      a.memberId,
      nameJa:        a.member.userRef.nameJa,
      partId:        a.member.part?.id        ?? null,
      partName:      a.member.part?.name      ?? null,
      partSortOrder: a.member.part?.sortOrder ?? 99,
      partVoiceType: a.member.part?.voiceType ?? "other",
      stageId:       a.stageId,
      status:        a.status,
    }));

    return c.json({
      data: {
        id:          concert.id,
        title:       concert.title,
        heldOn: concert.heldOn.toISOString(),
        venue:       concert.venue,
        status:      concert.status,
        linkedEventId: concert.linkedEvent?.id ?? null,
        stages: concert.stages.map((stage) => ({
          id:       stage.id,
          name:     stage.name,
          sortOrder: stage.sortOrder,
          programs: stage.programs.map((p) => ({
            id:       p.id,
            title:    p.title,
            sortOrder: p.sortOrder,
            score: p.score ? {
              id:       p.score.id,
              composer: p.score.composer,
              arranger: p.score.arranger,
            } : null,
          })),
          formationPatterns: stage.formationPatterns.map((pattern) => ({
            id:            pattern.id,
            name:          pattern.name,
            sortOrder:     pattern.sortOrder,
            isStaggered:   pattern.isStaggered,
            pianoPosition: pattern.pianoPosition,
            boxes: pattern.boxes.map((box) => ({
              id:        box.id,
              kind:      box.kind,
              title:     box.title,
              sortOrder: box.sortOrder,
            })),
            slots: pattern.slots
              .filter((slot) => !slot.member || !isHiddenRole(slot.member))
              .map((slot) => ({
                id:            slot.id,
                memberId:      slot.memberId,
                nameJa:        slot.member?.userRef.nameJa ?? null,
                partName:      slot.member?.part?.name ?? null,
                label:         slot.label,
                boxId:         slot.boxId,
                rowNum:        slot.rowNum,
                positionOrder: slot.positionOrder,
              })),
          })),
        })),
        surveys: concert.concertSurveys.map((s) => ({
          id:            s.id,
          title:         s.title,
          isOpen:        s.isOpen,
          openAt:        s.openAt.toISOString(),
          closeAt:       s.closeAt?.toISOString() ?? null,
          responseCount: s._count.surveyResponses,
        })),
        appliedSurveyId: concert.appliedSurveyId,
        assignments,
      },
    });
  })

  // ── PATCH /concerts/:id ── 基本情報を更新（admin のみ）
  .patch(
    "/concerts/:id",
    zValidator("json", z.object({
      title:                  z.string().min(1).optional(),
      heldOn:                 z.string().date().optional(),
      venue:                  z.string().nullable().optional(),
      status:                 z.enum(["draft", "survey_open", "confirmed", "past"]).optional(),
      outreachExpensePerTrip: z.number().int().min(0).nullable().optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { id } = c.req.param();

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ更新できます" } }, 403);
      }

      const concert = await prisma.concert.findUnique({
        where: { id },
        include: { linkedEvent: { select: { id: true } } },
      });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      const updated = await prisma.concert.update({
        where: { id },
        data: {
          ...(body.title                  !== undefined && { title: body.title }),
          ...(body.heldOn                 !== undefined && { heldOn: new Date(body.heldOn) }),
          ...(body.venue                  !== undefined && { venue: body.venue }),
          ...(body.status                 !== undefined && { status: body.status }),
          ...(body.outreachExpensePerTrip !== undefined && { outreachExpensePerTrip: body.outreachExpensePerTrip }),
        },
      });
      if (concert.linkedEvent) {
        await prisma.event.update({
          where: { id: concert.linkedEvent.id, orgId: org.id },
          data: {
            ...(body.title  !== undefined && { title: body.title }),
            ...(body.heldOn !== undefined && { startsAt: new Date(body.heldOn), endsAt: new Date(body.heldOn) }),
            ...(body.venue  !== undefined && { location: body.venue }),
          },
        });
      }
      return c.json({
        data: {
          id:          updated.id,
          title:       updated.title,
          heldOn: updated.heldOn.toISOString(),
          venue:       updated.venue,
          status:      updated.status,
        },
      });
    }
  )

  // ── DELETE /concerts/:id ── 削除（admin のみ）
  .delete("/concerts/:id", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { id } = c.req.param();

    if (!isAdmin(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ削除できます" } }, 403);
    }

    const concert = await prisma.concert.findUnique({
      where: { id },
      include: { linkedEvent: { select: { id: true } } },
    });
    if (!concert || concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
    }

    if (concert.linkedEvent) {
      await prisma.event.delete({ where: { id: concert.linkedEvent.id } });
    }
    await prisma.concert.delete({ where: { id } });

    return new Response(null, { status: 204 });
  })

  // ── POST /concerts/:concertId/surveys ── オンステ調査を新規作成（tech+）
  // 既存の開放中調査は自動クローズ
  .post(
    "/concerts/:concertId/surveys",
    zValidator("json", z.object({
      title:   z.string().min(1),
      closeAt: z.string().datetime({ offset: true }).optional().nullable(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId } = c.req.param();
      const concert = await prisma.concert.findUnique({
        where: { id: concertId },
        include: { stages: { select: { id: true } } },
      });

      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const { title, closeAt } = c.req.valid("json");

      const stages  = concert.stages.map((s) => ({ id: s.id }));
      const members = await prisma.member.findMany({
        where:  { orgId: org.id, status: "active", ...EXCLUDE_HIDDEN_ROLES },
        select: { id: true },
      });

      await prisma.concertSurvey.updateMany({ where: { concertId, isOpen: true }, data: { isOpen: false } });

      const survey = await prisma.concertSurvey.create({
        data: { concertId, title, openAt: new Date(), closeAt: closeAt ? new Date(closeAt) : null, isOpen: true },
      });

      await prisma.concert.update({ where: { id: concertId }, data: { status: "survey_open" } });

      if (stages.length > 0 && members.length > 0) {
        await prisma.surveyResponse.createMany({
          data: members.flatMap((m) =>
            stages.map((st) => ({ surveyId: survey.id, memberId: m.id, stageId: st.id, status: "undecided" as const }))
          ),
        });
      }

      return c.json({
        data: {
          id:            survey.id,
          title:         survey.title,
          isOpen:        survey.isOpen,
          openAt:        survey.openAt.toISOString(),
          closeAt:       survey.closeAt?.toISOString() ?? null,
          responseCount: 0,
        },
      }, 201);
    }
  )

  // ── GET /concerts/:concertId/surveys/:surveyId ── 調査詳細（回答マトリクス）
  .get("/concerts/:concertId/surveys/:surveyId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");
    const { concertId, surveyId } = c.req.param();

    if (isVisitor(actingMember)) {
      return c.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, 403);
    }

    const survey = await prisma.concertSurvey.findUnique({
      where: { id: surveyId },
      include: {
        concert: {
          select: {
            orgId:  true,
            stages: { orderBy: { sortOrder: "asc" }, select: { id: true } },
          },
        },
        surveyResponses: {
          select: { stageId: true, status: true, memberId: true, memo: true },
        },
      },
    });

    if (!survey || survey.concertId !== concertId || survey.concert.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "調査が見つかりません" } }, 404);
    }

    const orgMembers = await prisma.member.findMany({
      where:   { orgId: org.id, status: "active", ...EXCLUDE_HIDDEN_ROLES },
      include: {
        userRef: { select: { nameJa: true } },
        part:    { select: { id: true, name: true, sortOrder: true, voiceType: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // status カラムは Attendance（スケジュールの出欠）と共有する enum のため "maybe" も
    // 取りうるが、オンステ調査では使わないので "undecided" に丸めてフロントへ渡す
    const responseMap = new Map<string, Map<string, { status: "attending" | "absent" | "undecided"; memo: string | null }>>();
    survey.surveyResponses.forEach((r) => {
      if (!responseMap.has(r.memberId)) responseMap.set(r.memberId, new Map());
      responseMap.get(r.memberId)!.set(r.stageId, {
        status: r.status === "maybe" ? "undecided" : r.status,
        memo:   r.memo ?? null,
      });
    });

    const stages = survey.concert.stages;

    const stageSummaries = stages.map((stage) => {
      const counts = { attending: 0, absent: 0, undecided: 0 };
      orgMembers.forEach((m) => {
        const s = responseMap.get(m.id)?.get(stage.id)?.status ?? "undecided";
        counts[s]++;
      });
      return { stageId: stage.id, summary: counts };
    });

    const rows = orgMembers.map((m) => {
      const memberResponses = responseMap.get(m.id) ?? new Map();
      const memo = Array.from(memberResponses.values()).find((v) => v.memo)?.memo ?? null;
      return {
        memberId:      m.id,
        nameJa:        m.userRef.nameJa,
        partId:        m.part?.id        ?? null,
        partName:      m.part?.name      ?? null,
        partSortOrder: m.part?.sortOrder ?? 99,
        partVoiceType: m.part?.voiceType ?? "other",
        stages: stages.map((stage) => ({
          stageId: stage.id,
          status:  memberResponses.get(stage.id)?.status ?? "undecided",
        })),
        memo,
      };
    });

    return c.json({
      data: {
        id:             survey.id,
        title:          survey.title,
        isOpen:         survey.isOpen,
        closeAt:        survey.closeAt?.toISOString() ?? null,
        rows,
        stageSummaries,
      },
    });
  })

  // ── PATCH /concerts/:concertId/surveys/:surveyId ── 調査の開閉・タイトル変更（tech+）
  .patch(
    "/concerts/:concertId/surveys/:surveyId",
    zValidator("json", z.object({
      isOpen: z.boolean().optional(),
      title:  z.string().min(1).optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!hasRole(actingMember, "tech")) {
        return c.json({ error: { code: "FORBIDDEN", message: "技術系以上の権限が必要です" } }, 403);
      }

      const { concertId, surveyId } = c.req.param();
      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const survey = await prisma.concertSurvey.findUnique({ where: { id: surveyId } });
      if (!survey || survey.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "調査が見つかりません" } }, 404);
      }

      const body = c.req.valid("json");

      const updated = await prisma.concertSurvey.update({
        where: { id: surveyId },
        data: {
          ...(body.title  !== undefined && { title: body.title }),
          ...(body.isOpen !== undefined && { isOpen: body.isOpen }),
        },
      });

      let concertStatus = concert.status;
      if (body.isOpen === true) {
        await prisma.concertSurvey.updateMany({ where: { concertId, isOpen: true, id: { not: surveyId } }, data: { isOpen: false } });
        await prisma.concert.update({ where: { id: concertId }, data: { status: "survey_open" } });
        concertStatus = "survey_open";
      } else if (body.isOpen === false) {
        const stillOpen = await prisma.concertSurvey.count({ where: { concertId, isOpen: true, id: { not: surveyId } } });
        if (stillOpen === 0) {
          await prisma.concert.update({ where: { id: concertId }, data: { status: "confirmed" } });
          concertStatus = "confirmed";
          await applySurveyToOnStage(concertId, surveyId);
        } else {
          concertStatus = "survey_open";
        }
      }

      return c.json({ data: { id: updated.id, title: updated.title, isOpen: updated.isOpen, concertStatus } });
    }
  )

  // ── PUT /concerts/:concertId/surveys/:surveyId/respond ── 自分（または指定メンバー）の回答を一括更新
  .put(
    "/concerts/:concertId/surveys/:surveyId/respond",
    zValidator("json", z.object({
      responses: z.array(z.object({
        stageId: z.string(),
        status:  z.enum(["attending", "absent", "undecided"]),
      })).min(1).max(100),
      memo:           z.string().optional().nullable(),
      targetMemberId: z.string().optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const org          = c.get("org");
      const actingMember = c.get("member");
      const { concertId, surveyId } = c.req.param();

      const concert = await prisma.concert.findUnique({ where: { id: concertId } });
      if (!concert || concert.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "演奏会が見つかりません" } }, 404);
      }

      const survey = await prisma.concertSurvey.findUnique({ where: { id: surveyId } });
      if (!survey || survey.concertId !== concertId) {
        return c.json({ error: { code: "NOT_FOUND", message: "調査が存在しません" } }, 404);
      }

      if (!survey.isOpen && !isAdmin(actingMember)) {
        return c.json({ error: { code: "LOCKED", message: "調査は締め切られています" } }, 403);
      }

      const { responses, memo, targetMemberId } = c.req.valid("json");

      if (targetMemberId && targetMemberId !== actingMember.id && !isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ他のメンバーの回答を変更できます" } }, 403);
      }

      if (targetMemberId && targetMemberId !== actingMember.id) {
        const target = await prisma.member.findUnique({
          where: { id: targetMemberId },
          select: { orgId: true },
        });
        if (!target || target.orgId !== org.id) {
          return c.json({ error: { code: "NOT_FOUND", message: "指定されたメンバーが見つかりません" } }, 404);
        }
      }

      const memberId = targetMemberId ?? actingMember.id;

      const validStages = await prisma.stage.findMany({
        where: { concertId, concert: { orgId: org.id } },
        select: { id: true },
      });
      const validStageIds = new Set(validStages.map((s) => s.id));
      const invalidStage = responses.find((r) => !validStageIds.has(r.stageId));
      if (invalidStage) {
        return c.json({ error: { code: "NOT_FOUND", message: "無効なステージIDが含まれています" } }, 404);
      }

      await Promise.all(
        responses.map((r) =>
          prisma.surveyResponse.updateMany({
            where: { surveyId: survey.id, memberId, stageId: r.stageId },
            data:  { status: r.status, ...(memo !== undefined && { memo: memo ?? null }) },
          })
        )
      );

      // 締切済みの調査は管理者のみ編集可能（上のガード参照）。
      // 締切後の修正はオンステ確定にもその場で反映する（開設中は確定時にまとめて反映される）。
      if (!survey.isOpen) {
        await syncOnStageFromResponses(concertId, responses.map((r) => ({ memberId, stageId: r.stageId, status: r.status })));
      }

      return c.json({ data: { ok: true } });
    }
  );

