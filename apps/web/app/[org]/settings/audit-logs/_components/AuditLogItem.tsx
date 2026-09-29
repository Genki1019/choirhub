"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AuditLogItem as AuditLog } from "@/lib/audit-logs-api";
import { formatJaDateTime } from "@/lib/date";
import {
  AUDIT_ACTION_LABEL,
  AUDIT_CATEGORY_BADGE_CLASS,
  auditFieldLabel,
  formatAuditValue,
} from "@/lib/audit-log-labels";

export function AuditLogItem({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const changes = log.changes ? Object.entries(log.changes) : [];
  const expandable = changes.length > 0 || log.userAgent !== null;
  const badgeClass = log.category
    ? AUDIT_CATEGORY_BADGE_CLASS[log.category]
    : "bg-gray-100 text-gray-600";

  return (
    <li className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors enabled:hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${badgeClass}`}>
              {AUDIT_ACTION_LABEL[log.action] ?? log.action}
            </span>
            <span className="min-w-0 truncate text-sm text-gray-800" title={log.targetLabel}>
              {log.targetLabel}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {formatJaDateTime(log.createdAt)} ・ {log.actorName}
            {log.ipAddress && ` ・ ${log.ipAddress}`}
          </p>
        </div>
        {expandable && (
          <ChevronDown
            size={14}
            className={`mt-1 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="space-y-2 px-5 pb-4">
          {changes.length > 0 && (
            <dl className="divide-y divide-gray-100 rounded-lg bg-gray-50 text-xs">
              {changes.map(([field, { before, after }]) => (
                <div key={field} className="grid grid-cols-[5.5rem_1fr] gap-2 px-3 py-2">
                  <dt className="text-gray-500">{auditFieldLabel(field)}</dt>
                  <dd className="break-all text-gray-700">
                    <span className="text-gray-400">
                      {formatAuditValue(log.action, field, before)}
                    </span>
                    {" → "}
                    <span className="font-medium">
                      {formatAuditValue(log.action, field, after)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {log.userAgent && <p className="text-[11px] break-all text-gray-400">{log.userAgent}</p>}
        </div>
      )}
    </li>
  );
}
