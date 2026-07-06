"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { membersApi } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import { PageMain } from "@/components/PageMain";

type AuthState = "loading" | "allowed" | "denied";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { org } = useParams<{ org: string }>();
  const router   = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    membersApi.me(org)
      .then((me) => {
        const ok = me.roles.includes("admin") || me.roles.includes("finance");
        if (!ok) {
          router.replace(`/${org}`);
          return;
        }
        setAuthState("allowed");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) router.push("/login");
        setAuthState("denied");
      });
  }, [org, router]);

  return (
    <PageMain>
      {authState === "loading" ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-brand-500 rounded-full" />
        </div>
      ) : authState === "allowed" ? (
        children
      ) : null}
    </PageMain>
  );
}
