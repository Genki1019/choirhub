"use client";

import { Users } from "lucide-react";
import type { PartSummary } from "@/lib/members-api";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin",   label: "最高管理者" },
  { value: "tech",    label: "技術系" },
  { value: "score",   label: "楽譜がかり" },
  { value: "member",  label: "一般" },
  { value: "guest",   label: "客演" },
  { value: "visitor", label: "体験" },
];

function toggleItem(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

interface TargetAudienceSectionProps {
  parts: PartSummary[];
  targetRoles: string[];
  targetPartIds: string[];
  onRolesChange: (roles: string[]) => void;
  onPartIdsChange: (partIds: string[]) => void;
}

export function TargetAudienceSection({
  parts,
  targetRoles,
  targetPartIds,
  onRolesChange,
  onPartIdsChange,
}: TargetAudienceSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-3">
        <Users size={15} />
        招待対象
      </div>
      <p className="text-xs text-gray-400 mb-3">
        未選択の場合は全員が対象になります。両方選択した場合は AND 条件（役職かつパートに該当するメンバー）になります。
      </p>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-2">役職</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(opt => (
            <ToggleChip
              key={opt.value}
              label={opt.label}
              active={targetRoles.includes(opt.value)}
              onClick={() => onRolesChange(toggleItem(targetRoles, opt.value))}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">パート</p>
        {parts.length === 0 ? (
          <p className="text-xs text-gray-400">パートが登録されていません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {parts.map(part => (
              <ToggleChip
                key={part.id}
                label={part.name}
                active={targetPartIds.includes(part.id)}
                onClick={() => onPartIdsChange(toggleItem(targetPartIds, part.id))}
              />
            ))}
          </div>
        )}
      </div>

      {(targetRoles.length > 0 || targetPartIds.length > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-1.5 text-xs text-gray-500">
          <span className="shrink-0 font-medium">対象:</span>
          <span>
            {[
              targetRoles.length   > 0 && `役職（${targetRoles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label ?? r).join("・")}）`,
              targetPartIds.length > 0 && `パート（${targetPartIds.map(pid => parts.find(p => p.id === pid)?.name ?? pid).join("・")}）`,
            ].filter(Boolean).join(" AND ")}
          </span>
          <button
            type="button"
            onClick={() => { onRolesChange([]); onPartIdsChange([]); }}
            className="ml-auto shrink-0 text-gray-400 hover:text-gray-600 underline"
          >
            クリア
          </button>
        </div>
      )}
    </div>
  );
}
