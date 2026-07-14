"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { authApi } from "@/lib/auth-api";
import { useClickOutside } from "@/lib/useClickOutside";

interface Props {
  nameJa: string;
  avatarUrl: string | null;
  org: string;
  memberId: string;
}

export default function UserMenu({ nameJa, avatarUrl, org, memberId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useClickOutside(ref, () => setOpen(false), open);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ログアウト失敗時も /login へ遷移
    }
    router.push("/login");
  };

  const initial = nameJa.charAt(0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-brand-100 text-brand-700 font-semibold text-sm hover:ring-2 hover:ring-brand-300 transition-all"
        title={nameJa}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt={nameJa} width={32} height={32} className="w-full h-full object-cover" unoptimized />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-800 truncate">{nameJa}</p>
          </div>
          <Link
            href={`/${org}/members/${memberId}`}
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <User size={14} className="text-gray-400" />
            プロフィール
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={14} />
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
