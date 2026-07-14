import { PrismaClient } from "../src/generated/prisma/index.js";
import { hash } from "argon2";

const prisma = new PrismaClient();

// ─── helpers ─────────────────────────────────────────────────────────────────
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function atTime(date: Date, h: number, m = 0): Date {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

// ─── main seed（既存: 自分の団体） ───────────────────────────────────────────
async function seedAdmin() {
  const email = process.env.SEED_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_PASSWORD ?? "changeme123";
  const nameJa = process.env.SEED_NAME ?? "管理者";
  const orgName = process.env.SEED_ORG_NAME ?? "テスト合唱団";
  const orgSlug = process.env.SEED_ORG_SLUG ?? "test-choir";

  const passwordHash = await hash(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, nameJa },
  });

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { name: orgName, slug: orgSlug, partTemplate: [] },
  });

  const existing = await prisma.member.findFirst({ where: { userId: user.id, orgId: org.id } });
  if (!existing) {
    await prisma.member.create({
      data: { userId: user.id, orgId: org.id, roles: ["admin"], status: "active" },
    });
  }

  const catCount = await prisma.eventCategory.count({ where: { orgId: org.id } });
  if (catCount === 0) {
    await prisma.eventCategory.createMany({
      data: [
        { orgId: org.id, name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 1 },
        { orgId: org.id, name: "本番", slug: "concert", color: "#EF4444", sortOrder: 2 },
        { orgId: org.id, name: "会議", slug: "meeting", color: "#F59E0B", sortOrder: 3 },
        { orgId: org.id, name: "その他", slug: "other", color: "#6B7280", sortOrder: 4 },
      ],
    });
  }

  console.log("✅ adminシード完了");
  console.log(`   メール: ${email} / パスワード: ${password}`);
  console.log(`   URL  : https://choirhub-web.vercel.app/${orgSlug}`);
}

// ─── demo seed（ポートフォリオ用） ───────────────────────────────────────────
const DEMO_SLUG = "harmonia";
const DEMO_EMAIL = "demo@choirhub.app";
const DEMO_PASS = "Demo1234!";

const DEMO_MEMBER_EMAILS = [
  DEMO_EMAIL,
  "sakura@harmonia.example",
  "hina@harmonia.example",
  "misaki@harmonia.example",
  "nana@harmonia.example",
  "mai@harmonia.example",
  "taro@harmonia.example",
  "kenji@harmonia.example",
  "daisuke@harmonia.example",
  "makoto@harmonia.example",
];

async function seedDemo() {
  // ── 既存チェック ──────────────────────────────────────────────────────────
  const existingOrg = await prisma.organization.findUnique({ where: { slug: DEMO_SLUG } });
  if (existingOrg && process.env.SEED_RESET !== "true") {
    console.log(`⏭ デモ団体 "${DEMO_SLUG}" は既に存在します。SEED_RESET=true で上書きできます。`);
    return;
  }
  if (existingOrg) {
    const orgId = existingOrg.id;
    // recorder FK が RESTRICT のため手動で削除順序を制御
    await prisma.scorePurchase.deleteMany({ where: { score: { orgId } } });
    await prisma.collectionPayment.deleteMany({ where: { collection: { orgId } } });
    await prisma.collection.deleteMany({ where: { orgId } });
    await prisma.expense.deleteMany({ where: { orgId } });
    await prisma.mailLog.deleteMany({ where: { orgId } });
    await prisma.mailTemplate.deleteMany({ where: { orgId } });
    await prisma.outreachParticipant.deleteMany({ where: { activity: { concert: { orgId } } } });
    await prisma.outreachActivity.deleteMany({ where: { concert: { orgId } } });
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { email: { in: DEMO_MEMBER_EMAILS } } });
    console.log("🗑 デモデータをリセットしました。");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 直近の日曜日（今日が日曜なら今日）
  const lastSunday = addDays(today, -today.getDay());

  // ── 1. Organization ───────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: "混声合唱団 ハーモニア",
      slug: DEMO_SLUG,
      partTemplate: [],
      feeType: "monthly",
      defaultFeeAmount: 2000,
    },
  });

  // ── 2. EventCategories ────────────────────────────────────────────────────
  await prisma.eventCategory.createMany({
    data: [
      { orgId: org.id, name: "練習", slug: "rehearsal", color: "#3B82F6", sortOrder: 1 },
      { orgId: org.id, name: "本番", slug: "concert", color: "#EF4444", sortOrder: 2 },
      { orgId: org.id, name: "会議", slug: "meeting", color: "#F59E0B", sortOrder: 3 },
      { orgId: org.id, name: "その他", slug: "other", color: "#6B7280", sortOrder: 4 },
    ],
  });
  const [catRehearsal, , catMeeting] = await prisma.eventCategory.findMany({
    where: { orgId: org.id },
    orderBy: { sortOrder: "asc" },
  });

  // ── 3. Parts ──────────────────────────────────────────────────────────────
  await prisma.part.createMany({
    data: [
      { orgId: org.id, name: "ソプラノ", voiceType: "soprano", sortOrder: 1, isCustom: false },
      { orgId: org.id, name: "アルト", voiceType: "alto", sortOrder: 2, isCustom: false },
      { orgId: org.id, name: "テナー", voiceType: "tenor", sortOrder: 3, isCustom: false },
      { orgId: org.id, name: "バス", voiceType: "bass", sortOrder: 4, isCustom: false },
    ],
  });
  const [pSoprano, pAlto, pTenor, pBass] = await prisma.part.findMany({
    where: { orgId: org.id },
    orderBy: { sortOrder: "asc" },
  });

  // ── 4. MemberTypes ────────────────────────────────────────────────────────
  await prisma.memberType.createMany({
    data: [
      { orgId: org.id, name: "一般", defaultFeeAmount: 2000, sortOrder: 1 },
      { orgId: org.id, name: "学生", defaultFeeAmount: 1000, sortOrder: 2 },
    ],
  });
  const [mtGeneral, mtStudent] = await prisma.memberType.findMany({
    where: { orgId: org.id },
    orderBy: { sortOrder: "asc" },
  });

  // ── 5. Users & Members ────────────────────────────────────────────────────
  const pw = await hash(DEMO_PASS);

  type MemberDef = {
    email: string;
    nameJa: string;
    nameKana: string;
    partId: string;
    memberTypeId: string;
    roles: string[];
    joinedAt: Date;
    status: "active" | "offstage";
  };

  const memberDefs: MemberDef[] = [
    {
      email: DEMO_EMAIL,
      nameJa: "山田 恵子",
      nameKana: "ヤマダ ケイコ",
      partId: pAlto.id,
      memberTypeId: mtGeneral.id,
      roles: ["admin", "conductor"],
      joinedAt: new Date("2018-04-01"),
      status: "active",
    },
    {
      email: "sakura@harmonia.example",
      nameJa: "鈴木 さくら",
      nameKana: "スズキ サクラ",
      partId: pSoprano.id,
      memberTypeId: mtGeneral.id,
      roles: ["member", "score"],
      joinedAt: new Date("2019-09-01"),
      status: "active",
    },
    {
      email: "hina@harmonia.example",
      nameJa: "伊藤 ひな",
      nameKana: "イトウ ヒナ",
      partId: pSoprano.id,
      memberTypeId: mtStudent.id,
      roles: ["member"],
      joinedAt: new Date("2024-04-01"),
      status: "active",
    },
    {
      email: "misaki@harmonia.example",
      nameJa: "佐藤 美咲",
      nameKana: "サトウ ミサキ",
      partId: pSoprano.id,
      memberTypeId: mtGeneral.id,
      roles: ["member"],
      joinedAt: new Date("2021-04-01"),
      status: "active",
    },
    {
      email: "nana@harmonia.example",
      nameJa: "田中 なな",
      nameKana: "タナカ ナナ",
      partId: pAlto.id,
      memberTypeId: mtGeneral.id,
      roles: ["member"],
      joinedAt: new Date("2020-04-01"),
      status: "active",
    },
    {
      email: "mai@harmonia.example",
      nameJa: "森 麻衣",
      nameKana: "モリ マイ",
      partId: pAlto.id,
      memberTypeId: mtStudent.id,
      roles: ["member"],
      joinedAt: new Date("2023-09-01"),
      status: "active",
    },
    {
      email: "taro@harmonia.example",
      nameJa: "渡辺 太郎",
      nameKana: "ワタナベ タロウ",
      partId: pTenor.id,
      memberTypeId: mtGeneral.id,
      roles: ["member"],
      joinedAt: new Date("2019-04-01"),
      status: "active",
    },
    {
      email: "kenji@harmonia.example",
      nameJa: "小林 健二",
      nameKana: "コバヤシ ケンジ",
      partId: pTenor.id,
      memberTypeId: mtStudent.id,
      roles: ["member"],
      joinedAt: new Date("2025-04-01"),
      status: "active",
    },
    {
      email: "daisuke@harmonia.example",
      nameJa: "加藤 大輔",
      nameKana: "カトウ ダイスケ",
      partId: pBass.id,
      memberTypeId: mtGeneral.id,
      roles: ["member", "finance"],
      joinedAt: new Date("2018-04-01"),
      status: "active",
    },
    {
      email: "makoto@harmonia.example",
      nameJa: "松本 誠",
      nameKana: "マツモト マコト",
      partId: pBass.id,
      memberTypeId: mtGeneral.id,
      roles: ["member"],
      joinedAt: new Date("2022-07-01"),
      status: "active",
    },
  ];

  const members: { id: string; memberTypeId: string | null }[] = [];

  for (const def of memberDefs) {
    const user = await prisma.user.create({
      data: { email: def.email, passwordHash: pw, nameJa: def.nameJa, nameKana: def.nameKana },
    });
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        orgId: org.id,
        partId: def.partId,
        memberTypeId: def.memberTypeId,
        roles: def.roles,
        status: def.status,
        joinedAt: def.joinedAt,
      },
    });
    members.push({ id: member.id, memberTypeId: def.memberTypeId });
  }

  const adminMemberId = members[0].id;
  // 学生団員インデックス: 伊藤ひな(2), 森麻衣(5), 小林健二(7)
  const STUDENT_INDICES = new Set([2, 5, 7]);

  // ── 6. Events ─────────────────────────────────────────────────────────────
  // 過去5週 + 未来3週の日曜練習
  const rehearsalOffsets = [-35, -28, -21, -14, -7, 7, 14, 21];
  const rehearsalEvents: { id: string }[] = [];
  for (let i = 0; i < rehearsalOffsets.length; i++) {
    const day = addDays(lastSunday, rehearsalOffsets[i]);
    const isPast = day < today;
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: `第${i + 1}回練習`,
        categoryId: catRehearsal.id,
        startsAt: atTime(day, 13, 0),
        endsAt: atTime(day, 17, 0),
        location: "ハーモニア練習スタジオ（渋谷区）",
        deadline: isPast ? null : atTime(addDays(day, -2), 23, 59),
      },
    });
    rehearsalEvents.push(event);
  }

  // 過去の会議（1件）
  await prisma.event.create({
    data: {
      orgId: org.id,
      title: "第16回演奏会 準備委員会",
      categoryId: catMeeting.id,
      startsAt: atTime(addDays(today, -10), 19, 0),
      endsAt: atTime(addDays(today, -10), 21, 0),
      location: "オンライン（Zoom）",
    },
  });

  // ── 7. 出欠（過去5回の練習） ──────────────────────────────────────────────
  const pastEvents = rehearsalEvents.slice(0, 5);
  // [団員インデックス][イベントインデックス] = status
  type Att = "attending" | "absent" | "maybe" | "undecided";
  const attPatterns: Att[][] = [
    ["attending", "attending", "attending", "attending", "attending"], // 山田（常に出席）
    ["absent", "attending", "attending", "attending", "attending"], // 鈴木
    ["attending", "absent", "attending", "attending", "absent"], // 伊藤
    ["attending", "attending", "attending", "attending", "attending"], // 佐藤
    ["attending", "attending", "absent", "attending", "attending"], // 田中
    ["attending", "attending", "attending", "absent", "attending"], // 森
    ["absent", "attending", "attending", "attending", "attending"], // 渡辺
    ["attending", "attending", "attending", "attending", "attending"], // 小林
    ["attending", "attending", "attending", "attending", "attending"], // 加藤
    ["attending", "absent", "attending", "absent", "attending"], // 松本
  ];
  for (let mi = 0; mi < members.length; mi++) {
    for (let ei = 0; ei < pastEvents.length; ei++) {
      await prisma.attendance.create({
        data: { eventId: pastEvents[ei].id, memberId: members[mi].id, status: attPatterns[mi][ei] },
      });
    }
  }

  // ── 8. Scores ─────────────────────────────────────────────────────────────
  const scores = await Promise.all([
    prisma.score.create({
      data: {
        orgId: org.id,
        title: "ハレルヤ",
        composer: "G. F. Handel",
        arranger: "合唱編曲版",
        accessLevel: "restricted",
        distributionPrice: 300,
        notes: "Messiah HWV 56 より",
        purchaseDate: new Date("2025-06-01"),
      },
    }),
    prisma.score.create({
      data: {
        orgId: org.id,
        title: "アヴェ・ヴェルム・コルプス",
        composer: "W. A. Mozart",
        accessLevel: "restricted",
        distributionPrice: 200,
        notes: "K. 618",
        purchaseDate: new Date("2025-06-01"),
      },
    }),
    prisma.score.create({
      data: {
        orgId: org.id,
        title: "主よ、人の望みの喜びよ",
        composer: "J. S. Bach",
        arranger: "合唱編曲版",
        accessLevel: "public",
        notes: "BWV 147 より",
      },
    }),
    prisma.score.create({
      data: {
        orgId: org.id,
        title: "歓喜の歌",
        composer: "L. v. Beethoven",
        arranger: "合唱編曲版",
        accessLevel: "public",
        notes: "交響曲第9番 第4楽章より",
      },
    }),
    prisma.score.create({
      data: {
        orgId: org.id,
        title: "ひかりのうた",
        composer: "田中 恵一",
        accessLevel: "secret",
        isCommissioned: true,
        notes: "第16回定期演奏会 委嘱作品",
      },
    }),
  ]);
  const [sHallelujah, sAveVerum, sJesu, sOdeToJoy, sHikari] = scores;

  // ── 9. Concerts ───────────────────────────────────────────────────────────
  const pastConcertDate = addDays(today, -87);
  const nextConcertDate = addDays(today, 96);

  // 第15回（終演済）
  const pastConcert = await prisma.concert.create({
    data: {
      orgId: org.id,
      title: "第15回定期演奏会",
      heldOn: pastConcertDate,
      venue: "東京文化会館 小ホール",
      status: "past",
      ticketInputClosedAt: addDays(pastConcertDate, 7),
    },
  });
  const st15a = await prisma.stage.create({
    data: { concertId: pastConcert.id, name: "前半", sortOrder: 1 },
  });
  const st15b = await prisma.stage.create({
    data: { concertId: pastConcert.id, name: "後半", sortOrder: 2 },
  });
  await Promise.all([
    prisma.program.create({
      data: { stageId: st15a.id, scoreId: sAveVerum.id, title: sAveVerum.title, sortOrder: 1 },
    }),
    prisma.program.create({
      data: { stageId: st15a.id, scoreId: sJesu.id, title: sJesu.title, sortOrder: 2 },
    }),
    prisma.program.create({
      data: { stageId: st15b.id, scoreId: sHallelujah.id, title: sHallelujah.title, sortOrder: 1 },
    }),
    prisma.program.create({
      data: { stageId: st15b.id, scoreId: sOdeToJoy.id, title: sOdeToJoy.title, sortOrder: 2 },
    }),
  ]);

  // 第15回 オンステ確定（全員出演）＋ フォーメーションパターン（前列5名・後列5名＋指揮）
  for (const stage of [st15a, st15b]) {
    await prisma.onStageAssignment.createMany({
      data: members.map((m) => ({
        concertId: pastConcert.id,
        memberId: m.id,
        stageId: stage.id,
        status: "on",
      })),
    });

    const pattern = await prisma.formationPattern.create({
      data: {
        stageId: stage.id,
        name: "メインフォーメーション",
        sortOrder: 1,
        boxes: {
          create: [
            { kind: "conductor", sortOrder: 1 },
            { kind: "piano", sortOrder: 2 },
          ],
        },
      },
      include: { boxes: true },
    });
    const conductorBox = pattern.boxes.find((b) => b.kind === "conductor")!;
    const pianoBox = pattern.boxes.find((b) => b.kind === "piano")!;

    // 山台1段目以降=1,2,...
    const frontRow = members.slice(0, 5);
    const backRow = members.slice(5);
    await prisma.formationSlot.createMany({
      data: [
        { patternId: pattern.id, label: "指揮者名", boxId: conductorBox.id, positionOrder: 1 },
        { patternId: pattern.id, label: "ピアニスト名", boxId: pianoBox.id, positionOrder: 1 },
        ...frontRow.map((m, i) => ({
          patternId: pattern.id,
          memberId: m.id,
          rowNum: 1,
          positionOrder: i + 1,
        })),
        ...backRow.map((m, i) => ({
          patternId: pattern.id,
          memberId: m.id,
          rowNum: 2,
          positionOrder: i + 1,
        })),
      ],
    });
  }

  // 第16回（調査中）
  const nextConcert = await prisma.concert.create({
    data: {
      orgId: org.id,
      title: "第16回定期演奏会",
      heldOn: nextConcertDate,
      venue: "横浜みなとみらいホール 小ホール",
      status: "survey_open",
      outreachExpensePerTrip: 500,
    },
  });
  const st16a = await prisma.stage.create({
    data: { concertId: nextConcert.id, name: "第1ステージ", sortOrder: 1 },
  });
  const st16b = await prisma.stage.create({
    data: { concertId: nextConcert.id, name: "第2ステージ", sortOrder: 2 },
  });
  await Promise.all([
    prisma.program.create({
      data: { stageId: st16a.id, scoreId: sAveVerum.id, title: sAveVerum.title, sortOrder: 1 },
    }),
    prisma.program.create({
      data: { stageId: st16a.id, scoreId: sHikari.id, title: sHikari.title, sortOrder: 2 },
    }),
    prisma.program.create({
      data: { stageId: st16b.id, scoreId: sHallelujah.id, title: sHallelujah.title, sortOrder: 1 },
    }),
    prisma.program.create({
      data: { stageId: st16b.id, scoreId: sOdeToJoy.id, title: sOdeToJoy.title, sortOrder: 2 },
    }),
  ]);

  // 第16回 オンステ調査
  const survey = await prisma.concertSurvey.create({
    data: {
      concertId: nextConcert.id,
      title: "第16回定期演奏会 オンステ調査",
      openAt: addDays(today, -7),
      closeAt: addDays(nextConcertDate, -60),
      isOpen: true,
    },
  });
  // 回答パターン: [mi][stageIndex] = attending/absent/undecided
  type SurveyAtt = "attending" | "absent" | "undecided";
  const surveyPatterns: SurveyAtt[][] = [
    ["attending", "attending"],
    ["attending", "attending"],
    ["attending", "undecided"],
    ["attending", "attending"],
    ["attending", "attending"],
    ["attending", "attending"],
    ["attending", "attending"],
    ["undecided", "undecided"],
    ["attending", "attending"],
    ["absent", "attending"],
  ];
  for (let mi = 0; mi < members.length; mi++) {
    for (const [si, stage] of [
      [0, st16a],
      [1, st16b],
    ] as [number, { id: string }][]) {
      await prisma.surveyResponse.create({
        data: {
          surveyId: survey.id,
          memberId: members[mi].id,
          stageId: stage.id,
          status: surveyPatterns[mi][si],
        },
      });
    }
  }

  // ── 10. 楽譜購入記録 ──────────────────────────────────────────────────────
  const buyDate15 = addDays(pastConcertDate, -60);
  // ハレルヤ: 全員購入
  for (const m of members) {
    await prisma.scorePurchase.create({
      data: {
        scoreId: sHallelujah.id,
        memberId: m.id,
        amount: 300,
        purchasedAt: buyDate15,
        recordedById: adminMemberId,
      },
    });
  }
  // アヴェ・ヴェルム: 8名購入（後半2名未購入）
  for (const m of members.slice(0, 8)) {
    await prisma.scorePurchase.create({
      data: {
        scoreId: sAveVerum.id,
        memberId: m.id,
        amount: 200,
        purchasedAt: buyDate15,
        recordedById: adminMemberId,
      },
    });
  }

  // ── 11. チケットバッチ・配布 ─────────────────────────────────────────────
  // 第15回（終演済・回収済）
  const batch15 = await prisma.ticketBatch.create({
    data: {
      concertId: pastConcert.id,
      name: "一般",
      price: 2000,
      priceStudent: 1000,
      totalCount: 200,
    },
  });
  const soldAmounts = [15, 8, 6, 12, 9, 4, 7, 5, 11, 8];
  for (let i = 0; i < members.length; i++) {
    await prisma.ticketAllocation.create({
      data: {
        batchId: batch15.id,
        memberId: members[i].id,
        allocatedCount: 20,
        soldAdult: soldAmounts[i],
        soldStudent: Math.floor(soldAmounts[i] / 4),
        isCollected: true,
        reportedAt: pastConcertDate,
      },
    });
  }

  // 第16回（配布中・未回収）
  const batch16 = await prisma.ticketBatch.create({
    data: {
      concertId: nextConcert.id,
      name: "一般",
      price: 2500,
      priceStudent: 1500,
      totalCount: 200,
    },
  });
  for (const m of members) {
    await prisma.ticketAllocation.create({
      data: {
        batchId: batch16.id,
        memberId: m.id,
        allocatedCount: 10,
        requestedCount: 10,
        soldAdult: 0,
        isCollected: false,
      },
    });
  }

  // ── 12. 支出カテゴリ・支出 ────────────────────────────────────────────────
  await prisma.expenseCategory.createMany({
    data: [
      { orgId: org.id, name: "会場費", sortOrder: 1 },
      { orgId: org.id, name: "印刷費", sortOrder: 2 },
      { orgId: org.id, name: "備品", sortOrder: 3 },
      { orgId: org.id, name: "交通費", sortOrder: 4 },
      { orgId: org.id, name: "その他", sortOrder: 5 },
    ],
  });
  const [ecVenue, ecPrint, ecEquip, , ecOther] = await prisma.expenseCategory.findMany({
    where: { orgId: org.id },
    orderBy: { sortOrder: "asc" },
  });
  const expenseDefs = [
    {
      categoryId: ecVenue.id,
      title: "4月練習スタジオ代",
      amount: 8000,
      paidAt: addDays(today, -77),
      paymentMethod: "cash" as const,
    },
    {
      categoryId: ecVenue.id,
      title: "5月練習スタジオ代",
      amount: 8000,
      paidAt: addDays(today, -47),
      paymentMethod: "cash" as const,
    },
    {
      categoryId: ecVenue.id,
      title: "6月練習スタジオ代",
      amount: 8000,
      paidAt: addDays(today, -14),
      paymentMethod: "cash" as const,
    },
    {
      categoryId: ecPrint.id,
      title: "ハレルヤ楽譜印刷費",
      amount: 3500,
      paidAt: addDays(today, -80),
      paymentMethod: "bank_transfer" as const,
    },
    {
      categoryId: ecEquip.id,
      title: "指揮棒・文具一式",
      amount: 1200,
      paidAt: addDays(today, -60),
      paymentMethod: "cash" as const,
    },
    {
      categoryId: ecOther.id,
      title: "打ち上げ補助",
      amount: 5000,
      paidAt: addDays(today, -86),
      paymentMethod: "cash" as const,
    },
  ];
  for (const def of expenseDefs) {
    await prisma.expense.create({ data: { orgId: org.id, ...def, recordedById: adminMemberId } });
  }

  // ── 13. 徴収・支払い ──────────────────────────────────────────────────────
  type CollDef = { title: string; amount: number; yearMonth: string | null; paidCount: number };
  const collDefs: CollDef[] = [
    { title: "4月会費", amount: 2000, yearMonth: "2026-04", paidCount: 10 },
    { title: "5月会費", amount: 2000, yearMonth: "2026-05", paidCount: 10 },
    { title: "6月会費", amount: 2000, yearMonth: "2026-06", paidCount: 6 },
    { title: "演奏会積立", amount: 5000, yearMonth: "2026-09", paidCount: 3 },
    { title: "ハレルヤ楽譜代", amount: 300, yearMonth: null, paidCount: 10 },
  ];
  for (const def of collDefs) {
    const coll = await prisma.collection.create({
      data: {
        orgId: org.id,
        title: def.title,
        amount: def.amount,
        yearMonth: def.yearMonth,
        createdById: adminMemberId,
      },
    });
    for (let i = 0; i < members.length; i++) {
      const isPaid = i < def.paidCount;
      // 学生は会費半額（amount override）
      const isMonthlyFee = def.yearMonth !== null && def.title.includes("会費");
      const override = isMonthlyFee && STUDENT_INDICES.has(i) ? 1000 : null;
      await prisma.collectionPayment.create({
        data: {
          collectionId: coll.id,
          memberId: members[i].id,
          status: isPaid ? "paid" : "pending",
          amount: override,
          paidAt: isPaid ? addDays(today, -20 + i * 2) : null,
          method: isPaid ? "cash" : null,
          recordedById: isPaid ? adminMemberId : null,
        },
      });
    }
  }

  // ── 14. メールログ ────────────────────────────────────────────────────────
  const mailDefs = [
    {
      subject: "【ハーモニア】5月の練習日程について",
      bodyPreview:
        "5月の練習は毎週日曜日13:00〜17:00です。場所はいつものスタジオです。出欠の入力をお忘れなくお願いします。",
      sentAt: addDays(today, -42),
    },
    {
      subject: "【ハーモニア】第16回定期演奏会 日程確定のお知らせ",
      bodyPreview:
        "第16回定期演奏会の日程が確定しました。会場は横浜みなとみらいホール小ホールです。オンステ調査を本日より開始しますので、ご回答をお願いします。",
      sentAt: addDays(today, -14),
    },
    {
      subject: "【ハーモニア】楽譜配布のお知らせ（ハレルヤ・アヴェヴェルム）",
      bodyPreview:
        "第16回に向けて「ハレルヤ」「アヴェ・ヴェルム・コルプス」の楽譜をシステムにアップしました。購入記録のある方はダウンロードページよりお取りください。",
      sentAt: addDays(today, -7),
    },
  ];
  for (const def of mailDefs) {
    await prisma.mailLog.create({
      data: {
        orgId: org.id,
        sentById: adminMemberId,
        subject: def.subject,
        bodyPreview: def.bodyPreview,
        sentAt: def.sentAt,
        recipientMemberIds: members.map((m) => m.id),
      },
    });
  }

  console.log("✅ デモシード完了");
  console.log(`   URL     : https://choirhub-web.vercel.app/${DEMO_SLUG}`);
  console.log(`   ログイン: ${DEMO_EMAIL}`);
  console.log(`   パスワード: ${DEMO_PASS}`);
}

// ─── entry point ─────────────────────────────────────────────────────────────
async function main() {
  if (process.env.SEED_DEMO !== "true") {
    await seedAdmin();
  } else {
    await seedDemo();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
