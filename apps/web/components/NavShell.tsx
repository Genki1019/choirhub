"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";

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

export default function NavShell({ org, orgName, isAdmin, roles, nameJa, avatarUrl, memberId, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        org={org}
        orgName={orgName}
        isAdmin={isAdmin}
        roles={roles}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="shrink-0 flex items-center px-4 h-11 bg-white border-b border-gray-100">
          <button
            className="md:hidden p-1 -ml-1 mr-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="メニューを開く"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <UserMenu nameJa={nameJa || "？"} avatarUrl={avatarUrl} org={org} memberId={memberId} />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
