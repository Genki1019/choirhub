"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorMessage } from "@/components/ErrorMessage";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  danger: "bg-red-600 hover:bg-red-700",
  primary: "bg-brand-600 hover:bg-brand-700",
} as const;

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function activeElement(): HTMLElement | null {
  return typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null);
}

function focusPathFrom(el: HTMLElement | null): HTMLElement[] {
  const path: HTMLElement[] = [];
  for (let node = el; node && node !== document.body; node = node.parentElement) path.push(node);
  return path;
}

function restoreFocus(path: HTMLElement[]) {
  const [origin] = path;
  if (origin?.isConnected) {
    origin.focus();
    return;
  }
  if (document.activeElement && document.activeElement !== document.body) return;
  for (const container of path) {
    if (!container.isConnected) continue;
    const target = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).find(
      (el) => el.checkVisibility?.() ?? true,
    );
    if (target) {
      target.focus();
      return;
    }
  }
}

interface ConfirmDialogProps {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  tone?: keyof typeof TONE_CLASS;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = "danger",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [focusPath] = useState(() => focusPathFrom(activeElement()));

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          e.stopPropagation();
          if (busy) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          restoreFocus(focusPath);
        }}
        {...(description ? {} : { "aria-describedby": undefined })}
        className="gap-0 rounded-2xl border-0 p-0 shadow-xl sm:max-w-sm"
      >
        <div className="space-y-2 px-6 pt-5 pb-4">
          <AlertDialogTitle className="text-base leading-normal font-semibold text-gray-800">
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm break-words text-gray-500">
              {description}
            </AlertDialogDescription>
          )}
          <ErrorMessage autoScroll={false}>{error}</ErrorMessage>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <AlertDialogCancel
            disabled={busy}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            キャンセル
          </AlertDialogCancel>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60",
              TONE_CLASS[tone],
            )}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
