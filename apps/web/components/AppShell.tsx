"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";
import { AppFooter } from "@/components/AppFooter";

const DESKTOP_MQ = "(min-width: 1024px)";

interface Props {
  org: string;
  orgName: string;
  isAdmin: boolean;
  roles: string[];
  nameJa: string;
  avatarUrl: string | null;
  memberId: string;
  children: React.ReactNode;
}

export default function AppShell({ org, orgName, isAdmin, roles, nameJa, avatarUrl, memberId, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleClose = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MQ);
    const sync = () => setSidebarOpen(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        org={org}
        orgName={orgName}
        isAdmin={isAdmin}
        roles={roles}
        isOpen={sidebarOpen}
        onClose={handleClose}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="shrink-0 flex items-center px-4 h-11 bg-white border-b border-gray-100">
          <button
            className="p-1 -ml-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="メニューを開閉する"
          >
            <Menu size={20} />
          </button>
          <Link href={`/${org}`} className="flex items-center gap-1.5 ml-2 cursor-pointer hover:opacity-80 transition-opacity">
            <Image src="/icons/app-icon.svg" alt="ChoirHub" width={20} height={20} unoptimized className="size-5 cursor-pointer" />
            <span className="cursor-pointer text-sm font-bold text-gray-700">ChoirHub</span>
          </Link>
          <div className="flex-1" />
          <UserMenu nameJa={nameJa || "？"} avatarUrl={avatarUrl} org={org} memberId={memberId} />
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">{children}</div>
          <AppFooter />
        </div>
      </div>
    </div>
  );
}
