"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, History } from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditLogsApi, type AuditCategory, type AuditLogFilter } from "@/lib/audit-logs-api";
import { AUDIT_CATEGORY_LABEL } from "@/lib/audit-log-labels";
import { settingsKeys } from "@/lib/query-keys";
import { settingsPageTitle } from "@/lib/settings-nav";
import { useMember } from "@/contexts/MemberContext";
import { PageWithHeader } from "@/components/PageWithHeader";
import { Pagination } from "@/components/Pagination";
import { CsvExportButton } from "@/components/CsvExportButton";
import { AuditLogItem } from "./_components/AuditLogItem";

const SYSTEM_ADMIN_VALUE = "system_admin";

const INPUT_CLASS =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-brand-400 focus:outline-none";

export default function AuditLogsPage() {
  const { org } = useParams<{ org: string }>();
  const { roles } = useMember();
  const isAdmin = roles.includes("admin");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AuditLogFilter>({});
  const [page, setPage] = useState(1);

  const updateFilter = (patch: AuditLogFilter) => {
    setFilter((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };
  const hasFilter = Object.values(filter).some(Boolean);
  const clearFilter = () => {
    setFilter({});
    setPage(1);
  };

  // 絞り込み・ページ送り中も入力欄と直前の結果を表示したままにする（全体をローディング表示に置き換えない）
  const {
    data: result,
    isLoading,
    isPlaceholderData,
    error,
  } = useQuery({
    queryKey: [...settingsKeys.auditLogs(org), filter, page],
    queryFn: () => auditLogsApi.list(org, { ...filter, page }),
    placeholderData: keepPreviousData,
    enabled: isAdmin,
  });

  const { data: actors = [] } = useQuery({
    queryKey: settingsKeys.auditLogActors(org),
    queryFn: () => auditLogsApi.actors(org),
    enabled: isAdmin,
  });

  const logs = result?.data ?? [];
  const meta = result?.meta ?? { total: 0, page, perPage: 50 };

  return (
    <PageWithHeader
      title={settingsPageTitle("/audit-logs")}
      badge={result ? <span className="text-sm text-gray-400">{meta.total}件</span> : undefined}
      loading={isAdmin && isLoading}
      mainClassName="mx-auto max-w-3xl space-y-4"
    >
      {!isAdmin ? (
        <p className="py-16 text-center text-sm text-gray-400">操作履歴は管理者のみ閲覧できます</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            権限・団体設定・会計の変更、CSV出力の履歴です。記録は2年間保存されます。
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              期間（開始）
              <input
                type="date"
                value={filter.from ?? ""}
                max={filter.to}
                onChange={(e) => updateFilter({ from: e.target.value || undefined })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              期間（終了）
              <input
                type="date"
                value={filter.to ?? ""}
                min={filter.from}
                onChange={(e) => updateFilter({ to: e.target.value || undefined })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              分類
              <select
                value={filter.category ?? ""}
                onChange={(e) =>
                  updateFilter({ category: (e.target.value || undefined) as AuditCategory })
                }
                className={INPUT_CLASS}
              >
                <option value="">すべて</option>
                {(Object.keys(AUDIT_CATEGORY_LABEL) as AuditCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {AUDIT_CATEGORY_LABEL[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              操作者
              <select
                value={filter.actorType ?? filter.actorId ?? ""}
                onChange={(e) =>
                  updateFilter(
                    e.target.value === SYSTEM_ADMIN_VALUE
                      ? { actorType: SYSTEM_ADMIN_VALUE, actorId: undefined }
                      : { actorType: undefined, actorId: e.target.value || undefined },
                  )
                }
                className={INPUT_CLASS}
              >
                <option value="">すべて</option>
                {actors.map((a) =>
                  a.type === "member" ? (
                    <option key={a.memberId} value={a.memberId}>
                      {a.name}
                    </option>
                  ) : (
                    <option key={SYSTEM_ADMIN_VALUE} value={SYSTEM_ADMIN_VALUE}>
                      {a.name}
                    </option>
                  ),
                )}
              </select>
            </label>
            {hasFilter && (
              <button
                type="button"
                onClick={clearFilter}
                className="py-1.5 text-sm text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
              >
                条件をクリア
              </button>
            )}
            <div className="ml-auto">
              <CsvExportButton
                onDownload={async () => {
                  await auditLogsApi.exportCsv(org, filter);
                  // 出力操作自体も記録されるため、一覧と操作者の選択肢を最新にする
                  await queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs(org) });
                }}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
              <AlertCircle size={16} />
              <span className="text-sm">{error.message}</span>
            </div>
          )}

          {!error && result && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <History size={28} className="mb-3 opacity-40" />
              {hasFilter ? (
                <p className="text-sm">条件に一致する操作履歴はありません</p>
              ) : (
                <>
                  <p className="text-sm">まだ操作履歴はありません</p>
                  <p className="mt-1 text-xs">
                    ロールの変更、会計記録の編集、CSV出力などを行うと、ここに記録されます
                  </p>
                </>
              )}
            </div>
          )}

          {!error && logs.length > 0 && (
            <div
              aria-busy={isPlaceholderData}
              className={`overflow-hidden rounded-xl border border-gray-200 bg-white transition-opacity ${
                isPlaceholderData ? "opacity-60" : ""
              }`}
            >
              <ul>
                {logs.map((log) => (
                  <AuditLogItem key={log.id} log={log} />
                ))}
              </ul>
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </PageWithHeader>
  );
}
