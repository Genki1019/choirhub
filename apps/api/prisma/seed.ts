import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email    = process.env.SEED_EMAIL    ?? "admin@example.com";
  const password = process.env.SEED_PASSWORD ?? "changeme123";
  const nameJa   = process.env.SEED_NAME     ?? "管理者";
  const orgName  = process.env.SEED_ORG_NAME ?? "テスト合唱団";
  const orgSlug  = process.env.SEED_ORG_SLUG ?? "test-choir";

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.upsert({
    where:  { email },
    update: {},
    create: { email, passwordHash, nameJa },
  });

  const org = await prisma.organization.upsert({
    where:  { slug: orgSlug },
    update: {},
    create: {
      name: orgName,
      slug: orgSlug,
      partTemplate: ["Tenor I", "Tenor II", "Baritone", "Bass"],
    },
  });

  const existing = await prisma.member.findFirst({
    where: { userId: user.id, orgId: org.id },
  });

  if (!existing) {
    await prisma.member.create({
      data: {
        userId: user.id,
        orgId:  org.id,
        roles:  ["admin"],
        status: "active",
      },
    });
  }

  const catCount = await prisma.eventCategory.count({ where: { orgId: org.id } });
  if (catCount === 0) {
    await prisma.eventCategory.createMany({
      data: [
        { orgId: org.id, name: "練習",   slug: "rehearsal", color: "#3B82F6", sortOrder: 1 },
        { orgId: org.id, name: "本番",   slug: "concert",   color: "#EF4444", sortOrder: 2 },
        { orgId: org.id, name: "会議",   slug: "meeting",   color: "#F59E0B", sortOrder: 3 },
        { orgId: org.id, name: "その他", slug: "other",     color: "#6B7280", sortOrder: 4 },
      ],
    });
  }

  console.log("✅ シード完了");
  console.log(`   メール    : ${email}`);
  console.log(`   パスワード: ${password}`);
  console.log(`   団体スラグ: ${orgSlug}`);
  console.log(`   URL       : https://choirhub-web.vercel.app/${orgSlug}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
