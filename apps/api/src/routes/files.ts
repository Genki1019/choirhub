import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { isAdmin, isVisitor } from "../services/access.js";
import { getVisibleScoreIds } from "./scores.js";
import { isInvited } from "./events.js";
import type { TenantEnv } from "../middleware/tenant.js";
import type { FileType } from "../generated/prisma/index.js";

const FILE_KINDS = ["score", "concert", "event"] as const;
type FileKindFilter = (typeof FILE_KINDS)[number];

const SCORE_FILE_TYPE_LABEL: Record<FileType, string> = {
  full_score: "楽譜PDF",
  part_score: "パート譜",
  midi: "MIDI",
  audio: "音源",
  other: "その他",
};

export const filesRouter = new Hono<TenantEnv>()

  // ── GET /files ── 楽譜・本番・イベントの添付ファイルを横断一覧（閲覧可能なもののみ）
  .get("/files", async (c) => {
    const actingMember = c.get("member");
    const org = c.get("org");

    const { kind } = c.req.query();
    if (kind !== undefined && !FILE_KINDS.includes(kind as FileKindFilter)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "kindが不正です" } }, 400);
    }
    const kindFilter = kind as FileKindFilter | undefined;

    // kind指定時も3種分のリレーションを常にincludeする（対象外の種別は空になるだけ）。
    // 団体単位のデータ規模では無視できるコストであり、kindごとに別クエリへ分岐する複雑さの方が見合わない。
    const rows = await prisma.storedFile.findMany({
      where: {
        orgId: org.id,
        kind: kindFilter ?? { in: [...FILE_KINDS] },
      },
      include: {
        scoreFile: {
          include: { score: { select: { id: true, title: true, accessLevel: true } } },
        },
        concertFile: { include: { concert: { select: { id: true, title: true } } } },
        eventFile: {
          include: {
            event: {
              select: { id: true, title: true, targetRoles: true, targetPartIds: true },
            },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    // 楽譜: 対象楽譜をまとめて閲覧可否判定（N+1回避）
    const scoreRows = rows.filter((r) => r.scoreFile?.score);
    const visibleScoreIds = await getVisibleScoreIds(
      actingMember,
      scoreRows.map((r) => r.scoreFile!.score),
    );
    const visitorAccess = isVisitor(actingMember);

    const visible = rows.filter((r) => {
      if (r.scoreFile) {
        if (!visibleScoreIds.has(r.scoreFile.scoreId)) return false;
        // visitorはfull_score以外のファイル種別を閲覧不可
        return !visitorAccess || r.scoreFile.fileType === "full_score";
      }
      if (r.concertFile) {
        return true; // 本番添付ファイルは全団員閲覧可
      }
      if (r.eventFile) {
        // events.tsのcanView（isAdmin(member) || isInvited(member, event)）と同じ判定
        return isAdmin(actingMember) || isInvited(actingMember, r.eventFile.event);
      }
      return false;
    });

    const data = visible.map((r) => {
      if (r.scoreFile) {
        return {
          id: r.id,
          kind: "score" as const,
          title: r.scoreFile.score.title,
          subtitle: SCORE_FILE_TYPE_LABEL[r.scoreFile.fileType],
          fileName: r.fileName,
          downloadUrl: `/api/v1/${org.slug}/scores/${r.scoreFile.scoreId}/files/${r.scoreFile.id}/download`,
          resourceLink: `/${org.slug}/scores/${r.scoreFile.scoreId}`,
        };
      }
      if (r.concertFile) {
        return {
          id: r.id,
          kind: "concert" as const,
          title: r.concertFile.label,
          subtitle: r.concertFile.concert.title,
          fileName: r.fileName,
          downloadUrl: `/api/v1/${org.slug}/concerts/${r.concertFile.concertId}/files/${r.concertFile.id}/download`,
          resourceLink: `/${org.slug}/concerts/${r.concertFile.concertId}`,
        };
      }
      const eventFile = r.eventFile!;
      return {
        id: r.id,
        kind: "event" as const,
        title: eventFile.label,
        subtitle: eventFile.event.title,
        fileName: r.fileName,
        downloadUrl: `/api/v1/${org.slug}/events/${eventFile.eventId}/files/${eventFile.id}/download`,
        resourceLink: `/${org.slug}/schedule/${eventFile.eventId}`,
      };
    });

    return c.json({ data });
  });
