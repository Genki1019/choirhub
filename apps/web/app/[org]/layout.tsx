import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AppShell from "@/components/AppShell";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

type OrgInfo = { orgSlug: string; orgName: string; memberId: string; roles: string[] };
type AuthUser = { nameJa: string; avatarUrl: string | null };

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie?.value) {
    redirect("/login");
  }

  let orgName = org;
  let isAdmin = false;
  let roles: string[] = [];
  let nameJa = "";
  let avatarUrl: string | null = null;
  let memberId = "";

  try {
    const res = await fetch(`${API}/api/v1/auth/me`, {
      headers: { Cookie: `session=${sessionCookie.value}` },
      cache: "no-store",
    });

    if (!res.ok) {
      redirect("/login");
    }

    const json: unknown = await res.json();
    const payload = json as { data?: { user?: AuthUser; orgs?: OrgInfo[] } };
    const user = payload.data?.user;
    const orgs = payload.data?.orgs ?? [];

    const matched = orgs.find((o) => o.orgSlug === org);

    if (!matched) {
      const first = orgs[0];
      redirect(first ? `/${first.orgSlug}` : "/login");
    }

    orgName = matched.orgName;
    roles   = matched.roles;
    isAdmin = matched.roles.includes("admin");
    nameJa = user?.nameJa ?? "";
    avatarUrl = user?.avatarUrl ?? null;
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
