"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileX } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-6">
        <div className="flex justify-center mb-4">
          <FileX size={48} className="text-gray-300" />
        </div>
        <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
        <p className="text-gray-500 text-base mb-1">ページまたはファイルが見つかりません</p>
        <p className="text-gray-400 text-sm mb-8">
          アクセス権がないか、ファイルが削除された可能性があります。
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-100 transition-colors"
          >
            ← 戻る
          </button>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors"
          >
            トップへ
          </Link>
        </div>
      </div>
    </div>
  );
}
