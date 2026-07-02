"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { membersApi } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

const ADMIN_TABS = [
  { label: "団体情報",           suffix: "" },
  { label: "パート管理",         suffix: "/parts" },
  { label: "ロール管理",         suffix: "/roles" },
  { label: "会費設定",           suffix: "/fee" },
  { label: "支出カテゴリ",       suffix: "/expense-categories" },
  { label: "メンバー区分",       suffix: "/member-types" },
  { label: "イベント区分",       suffix: "/event-categories" },
];

const FINANCE_TABS = [
  { label: "会費設定",           suffix: "/fee" },
  { label: "支出カテゴリ",       suffix: "/expense-categories" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { org } = useParams<{ org: string }>();
  const pathname = usePathname();
  const router   = useRouter();
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [isFinance, setIsFinance] = useState(false);
  const [checked,   setChecked]   = useState(false);

  useEffect(() => {
    membersApi.me(org)
      .then((me) => {
        const admin   = me.roles.includes("admin");
        const finance = me.roles.includes("finance");
        if (!admin && !finance) {
          router.replace(`/${org}`);
          return;
        }
        setIsAdmin(admin);
        setIsFinance(finance);
        setChecked(true);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) router.push("/login");
        setChecked(true);
      });
  }, [org, router]);

  const tabs = isAdmin ? ADMIN_TABS : FINANCE_TABS;
  const allowed = isAdmin || isFinance;

  return (
    <div className="flex flex-col">
      <header className="shrink-0 bg-white border-b border-gray-200">
        <PageBleedRow className="py-4">
          <h1 className="text-lg font-semibold text-gray-800">設定</h1>
        </PageBleedRow>
      </header>

      <div className="shrink-0 bg-white border-b border-gray-200">
        <PageBleedRow className="flex flex-wrap">
          {allowed &&
            tabs.map(({ label, suffix }) => {
              const href     = `/${org}/settings${suffix}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={suffix}
                  href={href}
                  className={[
                    "px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    isActive
                      ? "border-brand-500 text-brand-600"
                      : "border-transparent text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
        </PageBleedRow>
      </div>

      <PageMain>
        {!checked ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-brand-500 rounded-full" />
          </div>
        ) : allowed ? (
          children
        ) : null}
      </PageMain>
    </div>
  );
}
