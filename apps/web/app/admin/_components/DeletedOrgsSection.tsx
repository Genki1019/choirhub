"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { deletedOrgsApi, type DeletedOrg } from "@/lib/deleted-orgs-api";
import { deletedOrgKeys } from "@/lib/query-keys";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));
}

export function DeletedOrgsSection() {
  const queryClient = useQueryClient();
  const {
    data: orgs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: deletedOrgKeys.list(),
    queryFn: deletedOrgsApi.list,
  });
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRestore(org: DeletedOrg) {
    setRestoringId(org.id);
    setActionError(null);
    try {
      await deletedOrgsApi.restore(org.id);
      queryClient.setQueryData<DeletedOrg[]>(deletedOrgKeys.list(), (prev) =>
        prev?.filter((o) => o.id !== org.id),
      );
    } catch {
      setActionError("復元に失敗しました。もう一度お試しください。");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-semibold text-gray-800">削除済みの団体</h2>
      <p className="mb-4 text-xs text-gray-500">
        完全削除予定日を過ぎると、団体のすべてのデータが自動で完全に削除されます。
      </p>

      {actionError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {actionError}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <p role="alert" className="text-sm text-red-600">
          削除済み団体の取得に失敗しました。しばらくしてから再度お試しください。
        </p>
      ) : orgs.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">削除済みの団体はありません</p>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">{org.name}</p>
                <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                  <p>スラグ: {org.slug}</p>
                  <p>
                    削除日: {new Date(org.deletedAt).toLocaleDateString("ja-JP")}
                    {org.deletedByEmail && `（${org.deletedByEmail}）`}
                  </p>
                  <p className="text-red-500">
                    完全削除予定: {new Date(org.purgeScheduledAt).toLocaleDateString("ja-JP")}（残り
                    {daysUntil(org.purgeScheduledAt)}日）
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(org)}
                disabled={restoringId !== null}
                aria-label={`${org.name}を復元`}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                {restoringId === org.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                復元
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
