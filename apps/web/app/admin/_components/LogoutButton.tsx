"use client";

import { useRouter } from "next/navigation";
import { authApi } from "@/lib/auth-api";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        try {
          await authApi.logout();
        } catch {
          // ログアウト失敗時も /login へ遷移
        }
        router.push("/login");
      }}
      className="text-brand-500 text-xs hover:underline"
    >
      ログアウト
    </button>
  );
}
