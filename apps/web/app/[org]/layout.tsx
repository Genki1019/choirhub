import { redirect } from "next/navigation";
import { fetchSessionMe } from "@/lib/session-guard";
import AppShell from "@/components/AppShell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;

  let orgName = org;
  let isAdmin = false;
  let roles: string[] = [];
  let nameJa = "";
  let avatarUrl: string | null = null;
  let memberId = "";

  try {
    const payload = await fetchSessionMe();
    const orgs = payload.data?.orgs ?? [];
    const matched = orgs.find((o) => o.orgSlug === org);

    if (!matched) {
      const first = orgs[0];
      redirect(first ? `/${first.orgSlug}` : "/login");
    }

    orgName = matched.orgName;
    roles = matched.roles;
    isAdmin = matched.roles.includes("admin");
    nameJa = payload.data?.user.nameJa ?? "";
    avatarUrl = payload.data?.user.avatarUrl ?? null;
    memberId = matched.memberId;
  } catch (e) {
    // Next.js の redirect() は内部的に例外をスローするため再スロー
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    redirect("/login");
  }

  return (
    <AppShell
      org={org}
      orgName={orgName}
      isAdmin={isAdmin}
      roles={roles}
      nameJa={nameJa}
      avatarUrl={avatarUrl}
      memberId={memberId}
    >
      {children}
    </AppShell>
  );
}
