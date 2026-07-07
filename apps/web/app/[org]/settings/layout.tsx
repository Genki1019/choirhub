"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMember } from "@/contexts/MemberContext";
import { PageMain } from "@/components/PageMain";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const { roles } = useMember();

  const isAllowed = roles.includes("admin") || roles.includes("finance");

  useEffect(() => {
    if (!isAllowed) router.replace(`/${org}`);
  }, [isAllowed, org, router]);

  if (!isAllowed) return null;

  return <PageMain>{children}</PageMain>;
}
