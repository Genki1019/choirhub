"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Music, ChevronRight, Loader2, Users, Plus, X } from "lucide-react";
import { authApi, ApiClientError } from "@/lib/auth-api";
import { ROLE_LABELS } from "@/lib/roles";
import { OrgApplicationForm } from "@/components/OrgApplicationForm";

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  active: { label: "在団", dot: "bg-teal-400" },
  offstage: { label: "休団", dot: "bg-yellow-400" },
};

type OrgEntry = {
  orgSlug: string;
  orgName: string;
  roles: string[];
  partName: string | null;
  status: string;
};

export default function SelectOrgPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    authApi
      .me()
      .then((result) => {
        setUserName(result.user.nameJa);
        setUserEmail(result.user.email);
        setIsSystemAdmin(result.user.isSystemAdmin);
        setOrgs(result.orgs);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) {
          router.replace("/login");
        } else {
          setLoadError("団体情報の取得に失敗しました。しばらくしてから再度お試しください。");
          setLoading(false);
        }
      });
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="mb-8 flex flex-col items-center">
          <div className="bg-brand-600 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="mt-1 text-sm text-gray-500">{userName} さん、ようこそ</p>
        </div>

        {/* 団体リスト */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              <Users size={12} />
              所属団体を選択
            </div>
          </div>

          {loadError ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Users size={32} className="mb-1 text-gray-200" />
              <p className="text-sm font-medium text-red-600">{loadError}</p>
            </div>
          ) : orgs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Users size={32} className="mb-1 text-gray-200" />
              <p className="text-sm font-medium text-gray-600">所属している団体がありません</p>
              <p className="text-xs text-gray-400">
                退団処理された可能性があります。団体の管理者にお問い合わせください。
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orgs.map((org) => {
                const status = STATUS_LABELS[org.status] ?? {
                  label: org.status,
                  dot: "bg-gray-400",
                };
                const displayRoles = org.roles
                  .filter((r) => r !== "member")
                  .map((r) => ROLE_LABELS[r] ?? r);

                return (
                  <li key={org.orgSlug}>
                    <button
                      onClick={() => router.push(`/${org.orgSlug}`)}
                      className="hover:bg-brand-50 group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors"
                    >
                      <div className="bg-brand-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white">
                        {org.orgName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {org.orgName}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {org.partName && (
                            <span className="text-xs text-gray-500">{org.partName}</span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                          {displayRoles.length > 0 && (
                            <span className="text-brand-600 text-xs font-medium">
                              {displayRoles.join(" / ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="group-hover:text-brand-400 shrink-0 text-gray-300 transition-colors"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 団体作成の申請 */}
        {showForm ? (
          <div className="mt-4 space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">団体作成を申請する</p>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="団体作成申請フォームを閉じる"
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <OrgApplicationForm initialName={userName} initialEmail={userEmail} />
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="hover:text-brand-600 hover:border-brand-300 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 transition-colors hover:bg-white"
          >
            <Plus size={16} />
            団体作成を申請する
          </button>
        )}

        <div className="mt-5 flex flex-col items-center gap-1.5 text-center text-xs text-gray-400">
          {isSystemAdmin && (
            <button
              onClick={() => router.push("/admin")}
              className="text-brand-500 hover:underline"
            >
              システム管理者コンソール
            </button>
          )}
          <p>
            別のアカウントでログインする場合は
            <button
              onClick={async () => {
                try {
                  await authApi.logout();
                } catch {
                  // ログアウト失敗時も /login へ遷移
                }
                router.push("/login");
              }}
              className="text-brand-500 ml-1 hover:underline"
            >
              ログアウト
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
