"use client";

import { Users } from "lucide-react";
import type { PartSummary } from "@/lib/members-api";
import { ROLE_OPTIONS } from "@/lib/roles";

function toggleItem(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-brand-600 border-brand-600 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
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
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600">
        <Users size={15} />
        招待対象
      </div>
      <p className="mb-3 text-xs text-gray-400">
        未選択の場合は全員が対象になります。両方選択した場合は AND
        条件（役職かつパートに該当するメンバー）になります。
      </p>

      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-gray-500">役職</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((opt) => (
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
        <p className="mb-2 text-xs font-medium text-gray-500">パート</p>
        {parts.length === 0 ? (
          <p className="text-xs text-gray-400">パートが登録されていません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {parts.map((part) => (
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
        <div className="mt-3 flex items-start gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span className="shrink-0 font-medium">対象:</span>
          <span>
            {[
              targetRoles.length > 0 &&
                `役職（${targetRoles.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r).join("・")}）`,
              targetPartIds.length > 0 &&
                `パート（${targetPartIds.map((pid) => parts.find((p) => p.id === pid)?.name ?? pid).join("・")}）`,
            ]
              .filter(Boolean)
              .join(" AND ")}
          </span>
          <button
            type="button"
            onClick={() => {
              onRolesChange([]);
              onPartIdsChange([]);
            }}
            className="ml-auto shrink-0 text-gray-400 underline hover:text-gray-600"
          >
            クリア
          </button>
        </div>
      )}
    </div>
  );
}
