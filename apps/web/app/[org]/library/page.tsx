"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";
import { useMember } from "@/contexts/MemberContext";
import { canManageAttachments } from "@/lib/roles";
import { documentsApi, type DocumentCategory, type OrgDocument } from "@/lib/documents-api";
import { filesApi, type CrossFileKind } from "@/lib/files-api";
import { concertsApi } from "@/lib/concerts-api";
import { eventsApi } from "@/lib/events-api";
import { libraryKeys, concertKeys, eventKeys } from "@/lib/query-keys";
import { UploadModal } from "./_components/UploadModal";
import { ResourcePickerModal } from "./_components/ResourcePickerModal";
import { ScoreFilesModal } from "./_components/ScoreFilesModal";
import { ResourceFilesModal } from "./_components/ResourceFilesModal";
import { FileRow } from "./_components/FileRow";

type CategoryTab = DocumentCategory | "all";
type MainTab = "documents" | CrossFileKind;

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "documents", label: "資料" },
  { id: "score", label: "楽譜" },
  { id: "concert", label: "本番" },
  { id: "event", label: "イベント" },
];

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

const ADD_BUTTON_LABEL: Record<CrossFileKind, string> = {
  score: "楽譜ファイルを追加",
  concert: "本番ファイルを追加",
  event: "イベントファイルを追加",
};

export default function LibraryPage() {
  const { org } = useParams<{ org: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { roles } = useMember();
  const isAdmin = roles.includes("admin");
  const canManageFiles = canManageAttachments(roles);
  const queryClient = useQueryClient();

  const tabParam = searchParams.get("tab");
  const mainTab: MainTab = MAIN_TABS.some((t) => t.id === tabParam)
    ? (tabParam as MainTab)
    : "documents";

  const categoryParam = searchParams.get("category");
  const activeCategory: CategoryTab = CATEGORY_TABS.some((t) => t.id === categoryParam)
    ? (categoryParam as CategoryTab)
    : "all";
  const categoryFilter = activeCategory === "all" ? undefined : activeCategory;

  const {
    data: documents = [],
    isLoading: loadingDocuments,
    error: documentsError,
  } = useQuery({
    queryKey: libraryKeys.list(org, categoryFilter),
    queryFn: () => documentsApi.list(org, categoryFilter),
    enabled: mainTab === "documents",
  });

  const crossKind = mainTab === "documents" ? null : mainTab;
  const {
    data: crossFiles = [],
    isLoading: loadingCrossFiles,
    error: crossFilesError,
  } = useQuery({
    queryKey: libraryKeys.crossKind(org, crossKind ?? ""),
    queryFn: () => filesApi.list(org, crossKind!),
    enabled: crossKind !== null,
  });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<OrgDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pickerKind, setPickerKind] = useState<CrossFileKind | null>(null);
  const [selectedResource, setSelectedResource] = useState<{
    kind: CrossFileKind;
    id: string;
    title: string;
  } | null>(null);

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

  const setTab = (id: MainTab) => {
    // タブを切り替えたら、他のタブ向けに開いていたピッカー/管理モーダルを残さない
    setPickerKind(null);
    setSelectedResource(null);
    const params = new URLSearchParams(searchParams);
    if (id === "documents") params.delete("tab");
    else params.set("tab", id);
    params.delete("category");
    router.replace(`/${org}/library${params.toString() ? `?${params}` : ""}`);
  };

  const setCategory = (id: CategoryTab) => {
    const params = new URLSearchParams(searchParams);
    if (id === "all") params.delete("category");
    else params.set("category", id);
    router.replace(`/${org}/library${params.toString() ? `?${params}` : ""}`);
  };

  const closeResourceModal = () => {
    if (selectedResource) {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.crossKind(org, selectedResource.kind),
      });
    }
    setSelectedResource(null);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="ファイルライブラリ"
        actions={
          mainTab === "documents" ? (
            isAdmin ? (
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
              >
                <Plus size={13} />
                資料を追加
              </button>
            ) : undefined
          ) : canManageFiles ? (
            <button
              onClick={() => setPickerKind(mainTab)}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              <Plus size={13} />
              {ADD_BUTTON_LABEL[mainTab]}
            </button>
          ) : undefined
        }
      >
        <PageBleedRow className="flex pt-1">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={[
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
                mainTab === tab.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </PageBleedRow>

        {mainTab === "documents" && (
          <PageBleedRow className="flex border-t border-gray-100 pt-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id)}
                className={[
                  "flex items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-medium transition-colors",
                  activeCategory === tab.id
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </PageBleedRow>
        )}
      </PageHeader>

      <PageMain>
        {mainTab === "documents" ? (
          loadingDocuments ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">読み込み中...</span>
            </div>
          ) : documentsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-500">
              資料の取得に失敗しました
            </div>
          ) : documents.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              登録されている資料はありません
            </p>
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
          )
        ) : loadingCrossFiles ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : crossFilesError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-500">
            ファイルの取得に失敗しました
          </div>
        ) : crossFiles.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">
            登録されているファイルはありません
          </p>
        ) : (
          <div className="space-y-1.5">
            {crossFiles.map((file) => (
              <FileRow key={file.id} file={file} />
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

      {pickerKind && (
        <ResourcePickerModal
          org={org}
          kind={pickerKind}
          onClose={() => setPickerKind(null)}
          onSelect={(resource) => {
            setSelectedResource({ kind: pickerKind, ...resource });
            setPickerKind(null);
          }}
        />
      )}

      {selectedResource?.kind === "score" && (
        <ScoreFilesModal org={org} scoreId={selectedResource.id} onClose={closeResourceModal} />
      )}
      {selectedResource?.kind === "concert" && (
        <ResourceFilesModal
          title={selectedResource.title}
          queryKey={concertKeys.files(org, selectedResource.id)}
          canManage={canManageFiles}
          listFiles={() => concertsApi.listFiles(org, selectedResource.id)}
          uploadFile={(file, label) =>
            concertsApi.uploadFile(org, selectedResource.id, file, label)
          }
          deleteFile={(fileId) => concertsApi.deleteFile(org, selectedResource.id, fileId)}
          onClose={closeResourceModal}
        />
      )}
      {selectedResource?.kind === "event" && (
        <ResourceFilesModal
          title={selectedResource.title}
          queryKey={eventKeys.files(org, selectedResource.id)}
          canManage={canManageFiles}
          listFiles={() => eventsApi.listFiles(org, selectedResource.id)}
          uploadFile={(file, label) => eventsApi.uploadFile(org, selectedResource.id, file, label)}
          deleteFile={(fileId) => eventsApi.deleteFile(org, selectedResource.id, fileId)}
          onClose={closeResourceModal}
        />
      )}
    </div>
  );
}
