"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { useMember } from "@/contexts/MemberContext";
import { documentsApi, type DocumentCategory, type OrgDocument } from "@/lib/documents-api";
import { libraryKeys } from "@/lib/query-keys";
import { UploadModal } from "./_components/UploadModal";

type CategoryTab = DocumentCategory | "all";

const CATEGORY_TABS: { id: CategoryTab; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "bylaws", label: "規約・規則" },
  { id: "minutes", label: "議事録" },
  { id: "member_guide", label: "団員ガイド" },
  { id: "finance_report", label: "会計報告" },
  { id: "other", label: "その他" },
];

const ACCESS_LEVEL_LABEL: Record<OrgDocument["accessLevel"], string> = {
  secret: "管理者限定",
  restricted: "団員限定",
  public: "客演にも公開",
};

export default function LibraryPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { roles } = useMember();
  const isAdmin = roles.includes("admin");
  const queryClient = useQueryClient();

  const categoryParam = searchParams.get("category");
  const activeCategory: CategoryTab = CATEGORY_TABS.some((t) => t.id === categoryParam)
    ? (categoryParam as CategoryTab)
    : "all";
  const categoryFilter = activeCategory === "all" ? undefined : activeCategory;

  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: libraryKeys.list(org, categoryFilter),
    queryFn: () => documentsApi.list(org, categoryFilter),
  });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<OrgDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(org, id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<OrgDocument[]>(libraryKeys.list(org, categoryFilter), (prev) =>
        (prev ?? []).filter((d) => d.id !== id),
      );
      setConfirmTarget(null);
      setDeleteError(null);
    },
    onError: () => setDeleteError("削除に失敗しました"),
  });

  const setCategory = (id: CategoryTab) => {
    const params = new URLSearchParams(searchParams);
    if (id === "all") params.delete("category");
    else params.set("category", id);
    router.replace(`/${org}/library${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="資料ライブラリ"
        actions={
          isAdmin ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              <Plus size={13} />
              資料を追加
            </button>
          ) : undefined
        }
      >
        <PageBleedRow className="flex pt-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={[
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
                activeCategory === tab.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </PageBleedRow>
      </PageHeader>

      <PageMain>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-500">
            資料の取得に失敗しました
          </div>
        ) : documents.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">登録されている資料はありません</p>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3"
              >
                <FileText size={15} className="text-brand-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-700 hover:underline"
                  >
                    {doc.title}
                  </a>
                  <p className="truncate text-xs text-gray-400">{doc.fileName}</p>
                </div>
                <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500">
                  {ACCESS_LEVEL_LABEL[doc.accessLevel]}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => setConfirmTarget(doc)}
                    title="削除"
                    className="shrink-0 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </PageMain>

      {showUploadModal && (
        <UploadModal
          org={org}
          defaultCategory={activeCategory === "all" ? "bylaws" : activeCategory}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            queryClient.invalidateQueries({ queryKey: libraryKeys.all(org) });
          }}
        />
      )}

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
          <div className="w-full max-w-xs rounded-xl bg-white p-5 shadow-lg">
            <p className="mb-1 text-sm font-semibold text-gray-800">資料を削除しますか？</p>
            <p className="mb-4 text-xs break-all text-gray-500">{confirmTarget.title}</p>
            {deleteError && <p className="mb-3 text-xs text-red-600">{deleteError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {deleteMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
