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
      <div className="space-y-3 px-4 text-center">
        <p className="text-8xl font-bold tracking-tight text-gray-200 select-none">404</p>
        <p className="font-medium text-gray-600">{message}</p>
        <button
          onClick={() => router.back()}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft size={14} />
          前のページに戻る
        </button>
      </div>
    </div>
  );
}
