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
        className="bg-brand-100 text-brand-700 hover:ring-brand-300 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-sm font-semibold transition-all hover:ring-2"
        title={nameJa}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={nameJa}
            width={32}
            height={32}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1.5 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <p className="truncate text-sm font-medium text-gray-800">{nameJa}</p>
          </div>
          <Link
            href={`/${org}/members/${memberId}`}
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            <User size={14} className="text-gray-400" />
            プロフィール
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-gray-50"
          >
            <LogOut size={14} />
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
