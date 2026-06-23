"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface NotFoundPageProps {
  message?: string;
}

export function NotFoundPage({ message = "ページが見つかりません" }: NotFoundPageProps) {
  const router = useRouter();
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-3 px-4">
        <p className="text-8xl font-bold text-gray-200 select-none tracking-tight">404</p>
        <p className="text-gray-600 font-medium">{message}</p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 mt-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={14} />
          前のページに戻る
        </button>
      </div>
    </div>
  );
}
