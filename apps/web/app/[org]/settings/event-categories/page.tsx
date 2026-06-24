"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { CategoryList } from "./_components/CategoryList";
import { AddCategoryForm } from "./_components/AddCategoryForm";

export default function EventCategoriesPage() {
  const { org }  = useParams<{ org: string }>();
  const router   = useRouter();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    settingsApi.listEventCategories(org)
      .then(setCategories)
      .catch(() => setError("読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [org]);

  const handleUpdated = (updated: EventCategory) => {
    setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    router.refresh();
  };
  const handleDeleted = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  };
  const handleCreated = (cat: EventCategory) => {
    setCategories((prev) => [...prev, cat]);
    router.refresh();
  };
  const handleReordered = (reordered: EventCategory[]) => {
    setCategories(reordered);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">イベント区分</h2>
        <p className="text-xs text-gray-400 mt-0.5">練習・本番などのシステム標準区分は削除できません。名前・色の変更は可能です。</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <CategoryList
        categories={categories}
        org={org}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onReordered={handleReordered}
        onError={setError}
      />

      <AddCategoryForm
        org={org}
        onCreated={handleCreated}
      />

      <p className="text-xs text-gray-400">↑↓ で表示順を変更できます。</p>
    </div>
  );
}
