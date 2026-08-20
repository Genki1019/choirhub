"use client";

import Link from "next/link";
import { Music } from "lucide-react";
import { OrgApplicationForm } from "@/components/OrgApplicationForm";

export default function ApplyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="bg-brand-600 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="mt-1 text-sm text-gray-500">団体作成を申請する</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-8">
          <OrgApplicationForm />
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          すでにアカウントをお持ちの方は
          <Link href="/login" className="text-brand-500 ml-1 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
