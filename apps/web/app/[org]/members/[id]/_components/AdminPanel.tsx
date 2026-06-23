"use client";

import { useState } from "react";
import { ShieldCheck, Check, Loader2 } from "lucide-react";
import type { MemberProfile, PartSummary } from "@/lib/members-api";
import type { MemberType } from "@/lib/settings-api";
import type { MemberStatus } from "@/lib/api-types";
import { MANAGEABLE_ROLES } from "@/lib/roles";

const STATUS_OPTIONS = [
  { value: "active",    label: "在団" },
  { value: "offstage",  label: "休団" },
  { value: "alumni",    label: "OB" },
  { value: "suspended", label: "停止" },
];

interface AdminPanelProps {
  member: MemberProfile;
  parts: PartSummary[];
  memberTypes: MemberType[];
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

export function AdminPanel({ member, parts, memberTypes, onUpdate }: AdminPanelProps) {
  const [localRoles,        setLocalRoles]        = useState(member.roles.filter((r) => r !== "member"));
  const [localPartId,       setLocalPartId]       = useState(member.part?.id ?? "");
  const [localMemberTypeId, setLocalMemberTypeId] = useState(member.memberType?.id ?? "");
  const [localStatus,       setLocalStatus]       = useState<MemberStatus>(member.status);
  const [localMemo,         setLocalMemo]         = useState(member.adminMemo ?? "");
  const [saving,            setSaving]            = useState(false);

  const toggleRole = (role: string) =>
    setLocalRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        roles:        ["member", ...localRoles],
        partId:       localPartId       || null,
        memberTypeId: localMemberTypeId || null,
        status:       localStatus,
        phone:        member.phone      || null,
        adminMemo:    localMemo         || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">管理者操作</h3>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">ロール</label>
        <div className="flex flex-wrap gap-2">
          {MANAGEABLE_ROLES.map(({ value, label }) => (
            <button key={value} onClick={() => toggleRole(value)}
              className={["text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                localRoles.includes(value)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-300",
              ].join(" ")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">パート</label>
          <select value={localPartId} onChange={(e) => setLocalPartId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">未設定</option>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
          <select value={localStatus} onChange={(e) => setLocalStatus(e.target.value as MemberStatus)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            {STATUS_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">メンバー区分</label>
        <select value={localMemberTypeId} onChange={(e) => setLocalMemberTypeId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">未設定</option>
          {memberTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.defaultFeeAmount != null ? ` (¥${t.defaultFeeAmount.toLocaleString()})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">管理者メモ</label>
        <textarea value={localMemo} onChange={(e) => setLocalMemo(e.target.value)} rows={2}
          placeholder="管理者のみ閲覧できるメモ"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        変更を保存
      </button>
    </div>
  );
}
