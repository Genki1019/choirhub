"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Calendar,
  Music,
  Star,
  Mail,
  Ticket,
  Settings,
  ChevronsUpDown,
  ChevronDown,
  Wallet,
  X,
} from "lucide-react";
import { SETTINGS_NAV_ITEMS } from "@/lib/settings-nav";

const BASE_NAV_ITEMS = [
  { suffix: "",             label: "ホーム",       icon: Home },
  { suffix: "/members",     label: "メンバー",     icon: Users },
  { suffix: "/schedule",    label: "スケジュール", icon: Calendar },
  { suffix: "/scores",      label: "楽譜",         icon: Music },
  { suffix: "/concerts",    label: "本番",         icon: Star },
  { suffix: "/mailing",     label: "メール",       icon: Mail },
  { suffix: "/tickets",     label: "チケット",     icon: Ticket },
];

const FINANCE_NAV_ITEMS = [
  { suffix: "/accounting",  label: "会計",         icon: Wallet },
];

const SETTINGS_FINANCE_SUFFIXES = new Set(["/fee", "/expense-categories"]);
const SETTINGS_FINANCE_ITEMS = SETTINGS_NAV_ITEMS.filter((item) =>
  SETTINGS_FINANCE_SUFFIXES.has(item.suffix)
);

const DESKTOP_MQ = "(min-width: 1024px)";

const VISITOR_HIDDEN_SUFFIXES = new Set(["/mailing", "/tickets"]);

function isFinancePlus(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("finance");
}

export default function Sidebar({
  org, orgName, isAdmin = false, roles = [], isOpen = false, onClose = () => {},
}: {
  org: string; orgName: string; isAdmin?: boolean; roles?: string[];
  isOpen?: boolean; onClose?: () => void;
}) {
  const pathname = usePathname();
  const isVisitor = roles.includes("visitor") && !roles.some((r) => ["admin", "tech", "score", "member", "ticket", "finance", "conductor"].includes(r));
  const financePlus = isFinancePlus(roles);
  const showSettings = isAdmin || financePlus;
  const isSettingsActive = pathname.startsWith(`/${org}/settings`);
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);
  const [prevSettingsActive, setPrevSettingsActive] = useState(isSettingsActive);

  useEffect(() => {
    if (!window.matchMedia(DESKTOP_MQ).matches) {
      onClose();
    }
  }, [pathname, onClose]);

  if (isSettingsActive !== prevSettingsActive) {
    setPrevSettingsActive(isSettingsActive);
    if (isSettingsActive) setSettingsOpen(true);
  }

  const navItems = [
    ...BASE_NAV_ITEMS.filter((item) => !(isVisitor && VISITOR_HIDDEN_SUFFIXES.has(item.suffix))),
    ...(financePlus ? FINANCE_NAV_ITEMS : []),
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={[
        "bg-white border-r border-gray-200 flex flex-col",
        "fixed inset-y-0 left-0 z-50 w-64",
        "lg:relative lg:z-auto lg:shrink-0",
        "transition-all duration-200 ease-in-out",
        isOpen
          ? "translate-x-0 lg:w-52"
          : "-translate-x-full lg:w-0 lg:overflow-hidden",
      ].join(" ")}>
        <button
          className="absolute top-3 right-3 p-1 rounded-md text-gray-400 hover:bg-gray-100 lg:hidden"
          onClick={onClose}
          aria-label="メニューを閉じる"
        >
          <X size={18} />
        </button>

        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-brand-600 font-bold text-lg leading-tight">ChoirHub</p>
          <Link
            href="/select-org"
            prefetch={false}
            className="flex items-center justify-between w-full mt-1.5 px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            title="団体を切り替える"
          >
            <span className="truncate">{orgName}</span>
            <ChevronsUpDown size={12} className="shrink-0 ml-1 text-gray-400" />
          </Link>
        </div>

        <nav className="flex-1 py-3">
          {navItems.map(({ suffix, label, icon: Icon }) => {
            const href     = `/${org}${suffix}`;
            const isActive = pathname === href;
            return (
              <Link
                key={suffix}
                href={href}
                prefetch={false}
                className={[
                  "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2",
                  isActive
                    ? "border-brand-500 bg-brand-50 text-brand-600 font-medium"
                    : "border-transparent text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                <Icon size={15} className={isActive ? "text-brand-500" : "text-gray-400"} />
                {label}
              </Link>
            );
          })}

          {showSettings && (
            <>
              <button
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((v) => !v)}
                className={[
                  "w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2",
                  isSettingsActive
                    ? "border-brand-500 bg-brand-50 text-brand-600 font-medium"
                    : "border-transparent text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                <Settings
                  size={15}
                  className={isSettingsActive ? "text-brand-500" : "text-gray-400"}
                />
                <span className="flex-1 text-left">設定</span>
                <ChevronDown
                  size={13}
                  className={[
                    "text-gray-400 transition-transform duration-200",
                    settingsOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              {settingsOpen && (
                <div className="pb-1">
                  {(isAdmin ? SETTINGS_NAV_ITEMS : SETTINGS_FINANCE_ITEMS).map(({ label, suffix }) => {
                    const href     = `/${org}/settings${suffix}`;
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={suffix}
                        href={href}
                        prefetch={false}
                        className={[
                          "flex items-center pl-12 pr-5 py-2 text-sm transition-colors border-l-2",
                          isActive
                            ? "border-brand-500 bg-brand-50 text-brand-600 font-medium"
                            : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700",
                        ].join(" ")}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
