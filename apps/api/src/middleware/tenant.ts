import { createMiddleware } from "hono/factory";
import { prisma } from "../lib/prisma.js";
import type { AuthEnv } from "./auth.js";
import type { Member, Organization } from "../generated/prisma/index.js";

export type TenantEnv = AuthEnv & {
  Variables: AuthEnv["Variables"] & {
    org: Organization;
    member: Member;
  };
};

export const tenantMiddleware = createMiddleware<TenantEnv>(async (c, next) => {
  const orgSlug = c.req.param("orgSlug");
  const user = c.get("user");

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    return c.json({ error: { code: "NOT_FOUND", message: "団体が見つかりません" } }, 404);
  }

  const member = await prisma.member.findUnique({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
  });
  if (!member) {
    return c.json({ error: { code: "FORBIDDEN", message: "この団体へのアクセス権限がありません" } }, 403);
  }

  if (member.status === "suspended") {
    return c.json({ error: { code: "FORBIDDEN", message: "アカウントが停止されています" } }, 403);
  }

  c.set("org", org);
  c.set("member", member);

  await next();
});
