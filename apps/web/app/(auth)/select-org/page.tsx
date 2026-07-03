"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Music, ChevronRight, Loader2, Users, Plus, X } from "lucide-react";
import { authApi, ApiClientError } from "@/lib/auth-api";
import { ROLE_LABELS } from "@/lib/roles";

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  active:   { label: "在団", dot: "bg-teal-400" },
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
  const [orgs, setOrgs]         = useState<OrgEntry[]>([]);
  const [userName, setUserName]  = useState("");
  const [loading, setLoading]    = useState(true);
  const [showForm, setShowForm]  = useState(false);
  const [orgName, setOrgName]    = useState("");
  const [orgSlug, setOrgSlug]    = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  useEffect(() => {
    authApi.me()
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mb-4">
            <Music size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChoirHub</h1>
          <p className="text-sm text-gray-500 mt-1">
            {userName} さん、ようこそ
          </p>
        </div>

        {/* 団体リスト */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <Users size={12} />
              所属団体を選択
            </div>
          </div>

          {orgs.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-6 text-center gap-2">
              <Users size={32} className="text-gray-200 mb-1" />
              <p className="text-sm font-medium text-gray-600">所属している団体がありません</p>
              <p className="text-xs text-gray-400">退団処理された可能性があります。団体の管理者にお問い合わせください。</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orgs.map((org) => {
                const status = STATUS_LABELS[org.status] ?? { label: org.status, dot: "bg-gray-400" };
                const displayRoles = org.roles
                  .filter((r) => r !== "member")
                  .map((r) => ROLE_LABELS[r] ?? r);

                return (
                  <li key={org.orgSlug}>
                    <button
                      onClick={() => router.push(`/${org.orgSlug}`)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-brand-50 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shrink-0 text-white font-bold text-base">
                        {org.orgName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{org.orgName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {org.partName && (
                            <span className="text-xs text-gray-500">{org.partName}</span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                          {displayRoles.length > 0 && (
                            <span className="text-xs text-brand-600 font-medium">
                              {displayRoles.join(" / ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-brand-400 transition-colors shrink-0"
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
            className="mt-4 bg-white rounded-2xl border border-gray-200 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">新しい団体を作成</p>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">団体名</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="○○合唱団"
                  required
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  スラグ <span className="text-gray-400 font-normal">（URL に使用）</span>
                </label>
                <div className="flex items-center gap-1 text-sm border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
                  <span className="px-2 text-gray-400 select-none">choirhub.app/</span>
                  <input
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

            {formError && (
              <p className="text-xs text-red-600">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !orgName.trim() || !orgSlug.trim()}
              className="w-full py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "作成する"}
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-brand-600 hover:bg-white border border-dashed border-gray-300 hover:border-brand-300 rounded-2xl transition-colors"
          >
            <Plus size={16} />
            新しい団体を作成
          </button>
        )}

        <p className="text-xs text-gray-400 text-center mt-5">
          別のアカウントでログインする場合は
          <button
            onClick={async () => {
              await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
              router.push("/login");
            }}
            className="text-brand-500 hover:underline ml-1"
          >
            ログアウト
          </button>
        </p>
      </div>
    </div>
  );
}
