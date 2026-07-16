"use client";

import { useState } from "react";
import { ShieldCheck, Check, Loader2, UserMinus } from "lucide-react";
import type { MemberProfile, PartSummary } from "@/lib/members-api";
import type { MemberType } from "@/lib/settings-api";
import { MEMBER_STATUS_OPTIONS } from "@/lib/api-types";
import type { MemberStatus } from "@/lib/api-types";
import { MANAGEABLE_ROLES } from "@/lib/roles";

interface AdminPanelProps {
  member: MemberProfile;
  parts: PartSummary[];
  memberTypes: MemberType[];
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function AdminPanel({ member, parts, memberTypes, onUpdate, onDelete }: AdminPanelProps) {
  const [localRoles, setLocalRoles] = useState(member.roles.filter((r) => r !== "member"));
  const [localPartId, setLocalPartId] = useState(member.part?.id ?? "");
  const [localMemberTypeId, setLocalMemberTypeId] = useState(member.memberType?.id ?? "");
  const [localStatus, setLocalStatus] = useState<MemberStatus>(member.status);
  const [localMemo, setLocalMemo] = useState(member.adminMemo ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleRole = (role: string) =>
    setLocalRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        roles: ["member", ...localRoles],
        partId: localPartId || null,
        memberTypeId: localMemberTypeId || null,
        status: localStatus,
        phone: member.phone || null,
        adminMemo: localMemo || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 rounded-xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">管理者操作</h3>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-600">ロール</label>
        <div className="flex flex-wrap gap-2">
          {MANAGEABLE_ROLES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggleRole(value)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                localRoles.includes(value)
                  ? "bg-brand-600 border-brand-600 text-white"
                  : "hover:border-brand-300 border-gray-200 bg-white text-gray-500",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="admin-part" className="mb-1 block text-xs font-medium text-gray-600">
            パート
          </label>
          <select
            id="admin-part"
            value={localPartId}
            onChange={(e) => setLocalPartId(e.target.value)}
            className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          >
            <option value="">未設定</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-status" className="mb-1 block text-xs font-medium text-gray-600">
            ステータス
          </label>
          <select
            id="admin-status"
            value={localStatus}
            onChange={(e) => setLocalStatus(e.target.value as MemberStatus)}
            className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          >
            {MEMBER_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="admin-memberType" className="mb-1 block text-xs font-medium text-gray-600">
          メンバー区分
        </label>
        <select
          id="admin-memberType"
          value={localMemberTypeId}
          onChange={(e) => setLocalMemberTypeId(e.target.value)}
          className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="">未設定</option>
          {memberTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.defaultFeeAmount != null ? ` (¥${t.defaultFeeAmount.toLocaleString()})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="admin-memo" className="mb-1 block text-xs font-medium text-gray-600">
          管理者メモ
        </label>
        <textarea
          id="admin-memo"
          value={localMemo}
          onChange={(e) => setLocalMemo(e.target.value)}
          rows={2}
          placeholder="管理者のみ閲覧できるメモ"
          className="focus:ring-brand-400 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          変更を保存
        </button>
        <button
          onClick={handleDelete}
          disabled={saving || deleting}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
          退団処理
        </button>
      </div>
    </div>
  );
}
