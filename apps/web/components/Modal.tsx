"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ReturnFocus {
  target: HTMLElement | null;
  fallback: ReturnFocus | null;
}

// 続けて開いたモーダル（選択 → 管理など）は、閉じたときに戻り先（前のモーダルの中の要素）が
// 消えているので、前のモーダルの戻り先をたどる
const returnFocusOf = new WeakMap<Element, ReturnFocus>();

function captureReturnFocus(): ReturnFocus {
  if (typeof document === "undefined") return { target: null, fallback: null };
  const target = document.activeElement as HTMLElement | null;
  const owner = target?.closest('[role="dialog"], [role="alertdialog"]');
  return { target, fallback: (owner && returnFocusOf.get(owner)) ?? null };
}

function resolveReturnFocus(rf: ReturnFocus | null): HTMLElement | null {
  if (!rf) return null;
  return rf.target?.isConnected ? rf.target : resolveReturnFocus(rf.fallback);
}

const SIZE_CLASS = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
} as const;

interface ModalProps {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  busy?: boolean;
  size?: keyof typeof SIZE_CLASS;
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({
  title,
  description,
  onClose,
  onSubmit,
  busy = false,
  size = "md",
  footer,
  children,
}: ModalProps) {
  const [returnFocus] = useState(captureReturnFocus);
  const content = (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">{footer}</div>
      )}
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-modal="true"
        ref={(el: HTMLDivElement | null) => {
          if (el) returnFocusOf.set(el, returnFocus);
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          resolveReturnFocus(returnFocus)?.focus();
        }}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 rounded-2xl border-0 p-0 shadow-xl",
          SIZE_CLASS[size],
        )}
      >
        <div className="space-y-1 border-b border-gray-100 py-4 pr-12 pl-6">
          <DialogTitle className="text-base leading-normal font-semibold text-gray-800">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-gray-500">{description}</DialogDescription>
          )}
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{content}</div>
        )}
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          disabled={busy}
          className="absolute top-[1.125rem] right-5 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40"
        >
          <X size={18} />
        </button>
      </DialogContent>
    </Dialog>
  );
}
