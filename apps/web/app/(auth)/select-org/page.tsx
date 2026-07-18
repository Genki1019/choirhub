"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Music, ChevronRight, Loader2, Users, Plus, X } from "lucide-react";
import { authApi, ApiClientError } from "@/lib/auth-api";
import { ROLE_LABELS } from "@/lib/roles";

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

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function SelectOrgPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then((result) => {
        setUserName(result.user.nameJa);
        setOrgs(result.orgs);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) {
          router.replace("/login");
        } else {
          setLoading(false);
        }
      });
  }, [router]);

  function handleNameChange(v: string) {
    setOrgName(v);
    if (!slugManual) setOrgSlug(toSlug(v));
  }

  function handleSlugChange(v: string) {
    setSlugManual(true);
    setOrgSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!orgName.trim() || !orgSlug.trim()) return;
    setSubmitting(true);
    try {
      const result = await authApi.createOrg({ name: orgName.trim(), slug: orgSlug.trim() });
      router.push(`/${result.orgSlug}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setFormError("このスラグはすでに使用されています");
      } else {
        setFormError("作成に失敗しました。しばらくしてから再試行してください");
      }
      setSubmitting(false);
    }
  }

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

          {orgs.length === 0 ? (
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

        {/* 団体作成 */}
        {showForm ? (
          <form
            onSubmit={handleCreate}
            className="mt-4 space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">新しい団体を作成</p>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                aria-label="団体作成フォームを閉じる"
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="orgName" className="mb-1 block text-xs font-medium text-gray-600">
                  団体名
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="○○合唱団"
                  required
                  maxLength={100}
                  className="focus:ring-brand-500 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="orgSlug" className="mb-1 block text-xs font-medium text-gray-600">
                  スラグ <span className="font-normal text-gray-400">（URL に使用）</span>
                </label>
                <div className="focus-within:ring-brand-500 flex items-center gap-1 overflow-hidden rounded-lg border border-gray-200 text-sm focus-within:ring-2">
                  <span className="px-2 text-gray-400 select-none">choirhub.app/</span>
                  <input
                    id="orgSlug"
                    type="text"
                    value={orgSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="my-choir"
                    required
                    minLength={2}
                    maxLength={50}
                    pattern="[a-z0-9-]+"
                    className="flex-1 py-2 pr-3 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={submitting || !orgName.trim() || !orgSlug.trim()}
              className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="mx-auto animate-spin" /> : "作成する"}
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="hover:text-brand-600 hover:border-brand-300 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 transition-colors hover:bg-white"
          >
            <Plus size={16} />
            新しい団体を作成
          </button>
        )}

        <p className="mt-5 text-center text-xs text-gray-400">
          別のアカウントでログインする場合は
          <button
            onClick={async () => {
              await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
              router.push("/login");
            }}
            className="text-brand-500 ml-1 hover:underline"
          >
            ログアウト
          </button>
        </p>
      </div>
    </div>
  );
}
