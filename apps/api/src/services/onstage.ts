import { prisma } from "../lib/prisma.js";

export type SurveyAtt = "attending" | "absent" | "maybe" | "undecided";

const RESPONSE_TO_ONSTAGE: Record<SurveyAtt, "on" | "off" | "undecided"> = {
  attending: "on",
  absent:    "off",
  maybe:     "undecided",
  undecided: "undecided",
};

// 指定した調査の回答内容で OnStageAssignment を直接上書きする（過去の反映内容や他調査との整合は見ない）。
// 調査締切時の自動反映、締切後の管理者による回答修正、明示的な「反映」操作のいずれからも呼ばれる。
export async function syncOnStageFromResponses(
  concertId: string,
  responses: { memberId: string; stageId: string; status: SurveyAtt }[],
) {
  if (responses.length === 0) return;

  await Promise.all(
    responses.map((r) => {
      const status = RESPONSE_TO_ONSTAGE[r.status];
      return prisma.onStageAssignment.upsert({
        where: { concertId_memberId_stageId: { concertId, memberId: r.memberId, stageId: r.stageId } },
        create: { concertId, memberId: r.memberId, stageId: r.stageId, status },
        update: { status },
      });
    })
  );

  // on でなくなったメンバーは、フォーメーションの配置枠からも削除する
  const droppedFromOn = responses.filter((r) => RESPONSE_TO_ONSTAGE[r.status] !== "on");
  if (droppedFromOn.length > 0) {
    await prisma.formationSlot.deleteMany({
      where: { OR: droppedFromOn.map((r) => ({ memberId: r.memberId, pattern: { stageId: r.stageId } })) },
    });
  }
}

// 指定した調査の回答内容でオンステ確定を反映し、その調査を「反映済み」として記録する
export async function applySurveyToOnStage(concertId: string, surveyId: string) {
  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId },
    select: { memberId: true, stageId: true, status: true },
  });
  await syncOnStageFromResponses(concertId, responses);
  await prisma.concert.update({ where: { id: concertId }, data: { appliedSurveyId: surveyId } });
}
