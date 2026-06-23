"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { ExpenseCategory } from "@/lib/accounting-api";
import { ExpenseCategoryCard } from "./_components/ExpenseCategoryCard";

export default function ExpenseCategoriesPage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const [cats,    setCats]    = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    settingsApi.listExpenseCategories(org)
      .then(setCats)
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [org, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <ExpenseCategoryCard
        cats={cats}
        org={org}
        onUpdated={(updated) => setCats((prev) => prev.map((c) => c.id === updated.id ? updated : c))}
        onDeleted={(id) => setCats((prev) => prev.filter((c) => c.id !== id))}
        onCreated={(created) => setCats((prev) => [...prev, created])}
        onToast={showToast}
      />

      <p className="text-xs text-gray-400">
        支出記録が紐付いているカテゴリは削除できません。
      </p>
    </div>
  );
}
