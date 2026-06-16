import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";
import { extname } from "path";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isVisitor } from "../services/access.js";
import { storage, CONTENT_TYPES } from "../services/storage.js";
import { toDateString } from "../lib/date.js";
import type { TenantEnv } from "../middleware/tenant.js";

const SCORE_FILE_TYPES = ["full_score", "part_score", "midi", "audio", "other"] as const;
type ScoreFileType = (typeof SCORE_FILE_TYPES)[number];

function fileErrorPage(status: 403 | 404, message: string): Response {
  const title = status === 404 ? "ファイルが見つかりません" : "アクセスできません";
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
    .box{text-align:center;padding:2rem}
    h1{font-size:3rem;font-weight:bold;color:#9ca3af;margin:0 0 .5rem}
    p{color:#6b7280;margin:.25rem 0}
    a{color:#3b82f6;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="box">
    <h1>${status}</h1>
    <p>${message}</p>
    <p style="margin-top:1rem"><a href="javascript:history.back()">← 戻る</a></p>
  </div>
</body>
</html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ファイル閲覧・購入記録参照（privileged viewer）
function isScorePrivileged(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("score") || roles.includes("tech") || roles.includes("conductor");
}

// 購入記録の管理
function canManagePurchases(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("score");
}

// 楽譜PDF・その他ファイルの管理
function canManageScorePdf(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("score");
}

// MIDIファイルの管理
function canManageScoreMidi(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("tech") || roles.includes("conductor");
}

export const scoresRouter = new Hono<TenantEnv>()

  // ── GET /scores ── フラット一覧（曲目選択ピッカー用）
  .get("/scores", async (c) => {
    const org = c.get("org");
    const scores = await prisma.score.findMany({
      where: { orgId: org.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, composer: true, arranger: true },
    });
    return c.json({ data: scores });
  })

  // ── GET /scores/grouped ── 演奏会別にまとめた楽譜一覧
  .get("/scores/grouped", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    const privileged = isScorePrivileged(actingMember.roles);

    // 楽譜ごとの購入者数（権限ありユーザー向け）
    const purchaseCountMap = privileged
      ? new Map(
          (await prisma.scorePurchase.groupBy({
            by: ["scoreId"],
            where: { score: { orgId: org.id } },
            _count: { scoreId: true },
          })).map((r) => [r.scoreId, r._count.scoreId])
        )
      : null;

    // 購入記録のある scoreId セットを取得（権限判定用）
    const myPurchasedScoreIds = privileged
      ? null
      : new Set(
          (await prisma.scorePurchase.findMany({
            where: { memberId: actingMember.id },
            select: { scoreId: true },
          })).map((p) => p.scoreId)
        );

    const visitorAccess = isVisitor(actingMember);

    function canAccessFiles(scoreId: string, accessLevel: string): boolean {
      // visitor は access_level 問わず全楽譜 PDF を閲覧可（requirements.md §楽譜管理 参照。意図的仕様）
      if (visitorAccess) return true;
      if (privileged) return true;
      if (accessLevel === "secret") return false; // 非特権メンバーは secret 不可
      // public / restricted 問わず購入記録が必要
      return myPurchasedScoreIds!.has(scoreId);
    }

    const [concerts, allScores] = await Promise.all([
      prisma.concert.findMany({
        where: { orgId: org.id },
        orderBy: { heldOn: "asc" },
        include: {
          stages: {
            orderBy: { sortOrder: "asc" },
            include: {
              programs: {
                orderBy: { sortOrder: "asc" },
                include: {
                  score: {
                    include: {
                      files: { orderBy: [{ fileType: "asc" }, { version: "asc" }] },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.score.findMany({
        where: { orgId: org.id },
        include: {
          files: { orderBy: [{ fileType: "asc" }, { version: "asc" }] },
          programs: { select: { id: true } },
        },
      }),
    ]);

    const parts = await prisma.part.findMany({ where: { orgId: org.id }, orderBy: { sortOrder: "asc" } });
    const partMap = new Map(parts.map((p) => [p.id, p.name]));

    type RawFile = { id: string; scoreId: string; fileType: string; fileName: string; storageKey: string; partId: string | null; version: number };
    const formatFile = (f: RawFile) => ({
      id: f.id, fileType: f.fileType, fileName: f.fileName,
      partId: f.partId, partName: f.partId ? (partMap.get(f.partId) ?? null) : null,
      version: f.version,
      downloadUrl: `/api/v1/${org.slug}/scores/${f.scoreId}/files/${f.id}/download`,
    });

    type RawScore = {
      id: string; title: string; composer: string | null; arranger: string | null;
      accessLevel: string; distributionPrice: number | null; files: RawFile[];
    };
    const formatScore = (s: RawScore) => {
      const access = canAccessFiles(s.id, s.accessLevel);
      return {
        id: s.id, title: s.title, composer: s.composer, arranger: s.arranger,
        accessLevel: s.accessLevel, distributionPrice: s.distributionPrice,
        canAccessFiles: access,
        canDownload: access && !visitorAccess,
        purchaseCount: purchaseCountMap !== null ? (purchaseCountMap.get(s.id) ?? 0) : undefined,
        // visitor には full_score のみ公開（MIDI の download URL を漏らさない）
        files: access
          ? s.files
              .filter((f) => !visitorAccess || f.fileType === "full_score")
              .map(formatFile)
          : [],
      };
    };

    const concertData = concerts.map((concert) => ({
      id: concert.id, title: concert.title,
      heldOn: toDateString(concert.heldOn),
      venue: concert.venue, status: concert.status,
      stages: concert.stages.map((stage) => ({
        id: stage.id, name: stage.name, sortOrder: stage.sortOrder,
        programs: stage.programs
          .filter((p) => p.score !== null)
          .map((p) => ({
            id: p.id, title: p.title, sortOrder: p.sortOrder,
            score: p.score ? formatScore(p.score) : null,
          })),
      })),
    }));

    const assignedScoreIds = new Set(allScores.flatMap((s) => (s.programs.length > 0 ? [s.id] : [])));
    const unassigned = allScores.filter((s) => !assignedScoreIds.has(s.id)).map(formatScore);

    return c.json({ data: { concerts: concertData, unassigned } });
  })

  // ── POST /scores ── 曲目を新規登録（admin のみ）
  .post(
    "/scores",
    zValidator("json", z.object({
      title:       z.string().min(1),
      composer:    z.string().optional().nullable(),
      arranger:    z.string().optional().nullable(),
      accessLevel: z.enum(["secret", "restricted", "public"]).default("restricted"),
      notes:       z.string().optional().nullable(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!isAdmin(actingMember)) {
        return c.json({ error: { code: "FORBIDDEN", message: "管理者のみ曲目を追加できます" } }, 403);
      }

      const body = c.req.valid("json");
      const score = await prisma.score.create({ data: { orgId: org.id, ...body } });

      return c.json({
        data: {
          id: score.id, title: score.title, composer: score.composer, arranger: score.arranger,
          accessLevel: score.accessLevel, distributionPrice: score.distributionPrice,
          canAccessFiles: true, files: [],
        },
      }, 201);
    }
  )

  // ── GET /scores/:scoreId/purchases ── 購入者一覧（楽譜がかり/admin）
  .get("/scores/:scoreId/purchases", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    if (!canManagePurchases(actingMember.roles)) {
      return c.json({ error: { code: "FORBIDDEN", message: "楽譜がかりまたは管理者のみ参照できます" } }, 403);
    }

    const { scoreId } = c.req.param();
    const score = await prisma.score.findUnique({ where: { id: scoreId } });
    if (!score || score.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
    }

    const purchases = await prisma.scorePurchase.findMany({
      where: { scoreId, member: { NOT: { roles: { hasSome: ["guest", "visitor"] } } } },
      include: {
        member: { include: { userRef: true, part: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return c.json({
      data: purchases.map((p) => ({
        memberId: p.memberId,
        nameJa: p.member.userRef.nameJa,
        partName: p.member.part?.name ?? null,
        purchasedAt: p.purchasedAt ? toDateString(p.purchasedAt) : null,
        note: p.note,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  })

  // ── PUT /scores/:scoreId/purchases ── 購入者を一括置換（楽譜がかり/admin）
  .put(
    "/scores/:scoreId/purchases",
    zValidator("json", z.object({
      memberIds: z.array(z.string()),
      purchasedAt: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!canManagePurchases(actingMember.roles)) {
        return c.json({ error: { code: "FORBIDDEN", message: "楽譜がかりまたは管理者のみ操作できます" } }, 403);
      }

      const { scoreId } = c.req.param();
      const score = await prisma.score.findUnique({ where: { id: scoreId } });
      if (!score || score.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
      }

      const { memberIds, purchasedAt, note } = c.req.valid("json");

      // メンバーがこの団体に所属しているか確認
      const members = await prisma.member.findMany({
        where: { id: { in: memberIds }, orgId: org.id },
        select: { id: true },
      });
      const validIds = new Set(members.map((m) => m.id));
      const filteredIds = memberIds.filter((id) => validIds.has(id));

      // 送信された ID に無効なものが含まれていれば弾く（サイレント消去防止）
      if (filteredIds.length !== memberIds.length) {
        return c.json({ error: { code: "BAD_REQUEST", message: "このユーザーに所属しないメンバーIDが含まれています" } }, 400);
      }

      await prisma.$executeRaw`DELETE FROM score_purchases WHERE score_id = ${scoreId}`;
      for (const memberId of filteredIds) {
        await prisma.scorePurchase.create({
          data: {
            scoreId,
            memberId,
            purchasedAt: purchasedAt ? new Date(purchasedAt) : null,
            note: note ?? null,
            recordedById: actingMember.id,
          },
        });
      }

      return c.json({ data: { updated: filteredIds.length } });
    }
  )

  // ── PATCH /scores/:scoreId/price ── 配布価格を設定（楽譜がかり/admin）
  .patch(
    "/scores/:scoreId/price",
    zValidator("json", z.object({
      price: z.number().int().min(0).nullable(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");

      if (!canManagePurchases(actingMember.roles)) {
        return c.json({ error: { code: "FORBIDDEN", message: "楽譜がかりまたは管理者のみ設定できます" } }, 403);
      }

      const { scoreId } = c.req.param();
      const score = await prisma.score.findUnique({ where: { id: scoreId } });
      if (!score || score.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
      }

      const { price } = c.req.valid("json");
      const updated = await prisma.score.update({
        where: { id: scoreId },
        data: { distributionPrice: price },
        select: { id: true, distributionPrice: true },
      });

      return c.json({ data: updated });
    }
  )

  // ── POST /scores/:scoreId/files/presign ── R2プレサインドPUT URL発行
  .post(
    "/scores/:scoreId/files/presign",
    zValidator("json", z.object({
      fileType:    z.enum(SCORE_FILE_TYPES),
      fileName:    z.string().min(1),
      partId:      z.string().nullable().optional(),
      contentType: z.string().min(1),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { scoreId } = c.req.param();

      const score = await prisma.score.findUnique({ where: { id: scoreId } });
      if (!score || score.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
      }

      const { fileType, fileName, partId, contentType } = c.req.valid("json");

      if (fileType === "midi") {
        if (!canManageScoreMidi(actingMember.roles)) {
          return c.json({ error: { code: "FORBIDDEN", message: "MIDIファイルの管理には管理者または技術系の権限が必要です" } }, 403);
        }
      } else {
        if (!canManageScorePdf(actingMember.roles)) {
          return c.json({ error: { code: "FORBIDDEN", message: "楽譜ファイルの管理には管理者または楽譜がかりの権限が必要です" } }, 403);
        }
      }

      if (partId) {
        const part = await prisma.part.findUnique({ where: { id: partId } });
        if (!part || part.orgId !== org.id) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "パートが見つかりません" } }, 400);
        }
      }

      const ext = extname(fileName).toLowerCase();
      if (fileType === "full_score" && ext !== ".pdf") {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "楽譜ファイルはPDF形式でアップロードしてください" } }, 400);
      }
      if (fileType === "midi" && ![".mid", ".midi", ".mp3"].includes(ext)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "MIDIは .mid / .midi / .mp3 形式でアップロードしてください" } }, 400);
      }
      if (fileType === "other" && ![".pdf", ".mp3", ".wav"].includes(ext)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "その他ファイルは .pdf / .mp3 / .wav 形式でアップロードしてください" } }, 400);
      }

      if (fileType === "full_score") {
        const existing = await prisma.scoreFile.findFirst({ where: { scoreId, fileType: "full_score" } });
        if (existing) {
          return c.json({ error: { code: "CONFLICT", message: "楽譜PDFはすでに登録されています。差し替えるには既存ファイルを削除してから追加してください" } }, 409);
        }
      }

      const key = `scores/${randomUUID()}${ext}`;
      const presignedUrl = await storage.getPresignedPutUrl(key, contentType);

      return c.json({ data: { presignedUrl, key } });
    }
  )

  // ── POST /scores/:scoreId/files/confirm ── R2アップロード後のDB登録
  .post(
    "/scores/:scoreId/files/confirm",
    zValidator("json", z.object({
      key:      z.string().regex(/^scores\/[0-9a-f-]+\.[a-z0-9]+$/i),
      fileType: z.enum(SCORE_FILE_TYPES),
      fileName: z.string().min(1),
      partId:   z.string().nullable().optional(),
    }), (r, c) => {
      if (!r.success) return c.json({ error: { code: "VALIDATION_ERROR", message: "入力値が不正です" } }, 400);
    }),
    async (c) => {
      const actingMember = c.get("member");
      const org = c.get("org");
      const { scoreId } = c.req.param();

      const score = await prisma.score.findUnique({ where: { id: scoreId } });
      if (!score || score.orgId !== org.id) {
        return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
      }

      const { key, fileType, fileName, partId } = c.req.valid("json");
      const resolvedPartId = partId ?? null;

      if (fileType === "midi") {
        if (!canManageScoreMidi(actingMember.roles)) {
          return c.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, 403);
        }
      } else {
        if (!canManageScorePdf(actingMember.roles)) {
          return c.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, 403);
        }
      }

      const ext = extname(key).toLowerCase();
      const maxVer = await prisma.scoreFile.aggregate({
        where: { scoreId, fileType: fileType as ScoreFileType, partId: resolvedPartId },
        _max: { version: true },
      });
      const version = (maxVer._max.version ?? 0) + 1;

      if (fileType === "full_score") {
        const conflict = await prisma.scoreFile.findFirst({ where: { scoreId, fileType: "full_score" } });
        if (conflict) {
          await storage.delete(key);
          return c.json({ error: { code: "CONFLICT", message: "楽譜PDFはすでに登録されています" } }, 409);
        }
      }
      const created = await prisma.scoreFile.create({
        data: { scoreId, fileType: fileType as ScoreFileType, partId: resolvedPartId, storageKey: key, fileName, version, uploadedBy: actingMember.id },
      });

      const partName = resolvedPartId
        ? (await prisma.part.findUnique({ where: { id: resolvedPartId }, select: { name: true } }))?.name ?? null
        : null;

      return c.json({
        data: {
          id: created.id, fileType: created.fileType, fileName: created.fileName,
          partId: created.partId, partName, version: created.version,
          downloadUrl: `/api/v1/${org.slug}/scores/${scoreId}/files/${created.id}/download`,
        },
      }, 201);
    }
  )

  // ── POST /scores/:scoreId/files ── ファイルアップロード（ローカル開発用・R2未設定時のフォールバック）
  .post("/scores/:scoreId/files", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    const { scoreId } = c.req.param();
    const score = await prisma.score.findUnique({ where: { id: scoreId } });
    if (!score || score.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
    }

    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "ファイルを選択してください" } }, 400);
    }
    const fileTypeResult = z.enum(SCORE_FILE_TYPES).safeParse(body["fileType"]);
    if (!fileTypeResult.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "ファイル種別が不正です" } }, 400);
    }
    const fileType = fileTypeResult.data;
    const partId = typeof body["partId"] === "string" && body["partId"] ? body["partId"] : null;
    if (partId) {
      const part = await prisma.part.findUnique({ where: { id: partId } });
      if (!part || part.orgId !== org.id) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "パートが見つかりません" } }, 400);
      }
    }

    // ファイル種別ごとの権限チェック
    if (fileType === "midi") {
      if (!canManageScoreMidi(actingMember.roles)) {
        return c.json({ error: { code: "FORBIDDEN", message: "MIDIファイルの管理には管理者または技術系の権限が必要です" } }, 403);
      }
    } else {
      if (!canManageScorePdf(actingMember.roles)) {
        return c.json({ error: { code: "FORBIDDEN", message: "楽譜ファイルの管理には管理者または楽譜がかりの権限が必要です" } }, 403);
      }
    }

    // 楽譜PDFは1曲につき1ファイルのみ
    if (fileType === "full_score") {
      const existing = await prisma.scoreFile.findFirst({ where: { scoreId, fileType: "full_score" } });
      if (existing) {
        return c.json({ error: { code: "CONFLICT", message: "楽譜PDFはすでに登録されています。差し替えるには既存ファイルを削除してから追加してください" } }, 409);
      }
    }

    const ext = extname(file.name).toLowerCase();
    if (fileType === "full_score" && ext !== ".pdf") {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "楽譜ファイルはPDF形式でアップロードしてください" } }, 400);
    }
    if (fileType === "midi" && ![".mid", ".midi", ".mp3"].includes(ext)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "MIDIは .mid / .midi / .mp3 形式でアップロードしてください" } }, 400);
    }
    if (fileType === "other" && ![".pdf", ".mp3", ".wav"].includes(ext)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "その他ファイルは .pdf / .mp3 / .wav 形式でアップロードしてください" } }, 400);
    }
    if (file.size > 20 * 1024 * 1024) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "ファイルサイズが上限を超えています（最大20MB）" } }, 400);
    }

    const maxVer = await prisma.scoreFile.aggregate({
      where: { scoreId, fileType: fileType as ScoreFileType, partId },
      _max: { version: true },
    });
    const version = (maxVer._max.version ?? 0) + 1;

    const storageKey = `scores/${randomUUID()}${ext}`;
    await storage.upload(storageKey, Buffer.from(await file.arrayBuffer()), CONTENT_TYPES[ext] ?? "application/octet-stream");

    if (fileType === "full_score") {
      const conflict = await prisma.scoreFile.findFirst({ where: { scoreId, fileType: "full_score" } });
      if (conflict) {
        await storage.delete(storageKey);
        return c.json({ error: { code: "CONFLICT", message: "楽譜PDFはすでに登録されています。差し替えるには既存ファイルを削除してから追加してください" } }, 409);
      }
    }
    const created = await prisma.scoreFile.create({
      data: {
        scoreId,
        fileType: fileType as ScoreFileType,
        partId,
        storageKey,
        fileName: file.name,
        version,
        uploadedBy: actingMember.id,
      },
    });

    const partName = partId
      ? (await prisma.part.findUnique({ where: { id: partId }, select: { name: true } }))?.name ?? null
      : null;

    return c.json({
      data: {
        id: created.id, fileType: created.fileType, fileName: created.fileName,
        partId: created.partId, partName,
        version: created.version,
        downloadUrl: `/api/v1/${org.slug}/scores/${scoreId}/files/${created.id}/download`,
      },
    }, 201);
  })

  // ── DELETE /scores/:scoreId/files/:fileId ── ファイル削除（admin/tech/score）
  .delete("/scores/:scoreId/files/:fileId", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    const { scoreId, fileId } = c.req.param();

    const score = await prisma.score.findUnique({ where: { id: scoreId } });
    if (!score || score.orgId !== org.id) {
      return c.json({ error: { code: "NOT_FOUND", message: "楽譜が見つかりません" } }, 404);
    }

    const scoreFile = await prisma.scoreFile.findUnique({ where: { id: fileId } });
    if (!scoreFile || scoreFile.scoreId !== scoreId) {
      return c.json({ error: { code: "NOT_FOUND", message: "ファイルが見つかりません" } }, 404);
    }

    // ファイル種別ごとの権限チェック
    if (scoreFile.fileType === "midi") {
      if (!canManageScoreMidi(actingMember.roles)) {
        return c.json({ error: { code: "FORBIDDEN", message: "MIDIファイルの管理には管理者または技術系の権限が必要です" } }, 403);
      }
    } else {
      if (!canManageScorePdf(actingMember.roles)) {
        return c.json({ error: { code: "FORBIDDEN", message: "楽譜ファイルの管理には管理者または楽譜がかりの権限が必要です" } }, 403);
      }
    }

    await storage.delete(scoreFile.storageKey);
    await prisma.scoreFile.delete({ where: { id: fileId, scoreId } });

    return new Response(null, { status: 204 });
  })

  // ── GET /scores/:scoreId/files/:fileId/download ── ファイルダウンロード
  .get("/scores/:scoreId/files/:fileId/download", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    const { scoreId, fileId } = c.req.param();

    const score = await prisma.score.findUnique({ where: { id: scoreId } });
    if (!score || score.orgId !== org.id) {
      return fileErrorPage(404, "楽譜が見つかりません");
    }

    const scoreFile = await prisma.scoreFile.findUnique({ where: { id: fileId } });
    if (!scoreFile || scoreFile.scoreId !== scoreId) {
      return fileErrorPage(404, "ファイルが見つかりません");
    }

    if (isVisitor(actingMember)) {
      // 体験（共有）アカウント: full_score のみ閲覧可
      if (scoreFile.fileType !== "full_score") {
        return fileErrorPage(403, "体験アカウントはPDFファイルのみ閲覧できます");
      }
    } else {
      const privileged = isScorePrivileged(actingMember.roles);
      if (!privileged) {
        // secret は非特権メンバーに不可
        if (score.accessLevel === "secret") {
          return fileErrorPage(403, "このファイルにアクセスする権限がありません");
        }
        // public / restricted 問わず購入記録が必要
        const purchase = await prisma.scorePurchase.findFirst({
          where: { scoreId, memberId: actingMember.id },
        });
        if (!purchase) {
          return fileErrorPage(403, "楽譜を購入してから閲覧できます");
        }
      }
    }

    const download = await storage.getScoreDownload(scoreFile.storageKey, scoreFile.fileName).catch(() => null);
    if (!download) {
      return fileErrorPage(404, "ファイルが見つかりません");
    }

    if (download.type === "redirect") {
      return c.redirect(download.url, 302);
    }

    return new Response(download.data, {
      headers: {
        "Content-Type": download.contentType,
        "Content-Disposition": download.disposition,
        "Content-Length": String(download.data.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
