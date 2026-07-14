"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileX } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="px-6 text-center">
        <div className="mb-4 flex justify-center">
          <FileX size={48} className="text-gray-300" />
        </div>
        <h1 className="mb-2 text-6xl font-bold text-gray-200">404</h1>
        <p className="mb-1 text-base text-gray-500">ページまたはファイルが見つかりません</p>
        <p className="mb-8 text-sm text-gray-400">
          アクセス権がないか、ファイルが削除された可能性があります。
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            ← 戻る
          </button>
          <Link
            href="/"
            className="text-brand-600 hover:text-brand-800 border-brand-200 hover:bg-brand-50 rounded-lg border px-4 py-2 text-sm transition-colors"
          >
            トップへ
          </Link>
        </div>
      </div>
    </div>
  );
}
