import type { Ref } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_SIZE = { md: 13, sm: 10 } as const;
const ACTION_SIZE = { md: 14, sm: 11 } as const;

interface InlineEditButtonProps {
  label: string;
  size?: keyof typeof ICON_SIZE;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
}

export function InlineEditButton({
  label,
  onClick,
  ref,
  disabled,
  className,
  size = "md",
}: InlineEditButtonProps) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label}を編集`}
      className={cn(
        "shrink-0 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40",
        size === "sm" ? "p-0.5" : "p-1",
        className,
      )}
    >
      <Pencil size={ICON_SIZE[size]} />
    </button>
  );
}

interface InlineEditActionsProps {
  label: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  size?: keyof typeof ACTION_SIZE;
}

export function InlineEditActions({
  label,
  saving,
  onSave,
  onCancel,
  saveDisabled,
  size = "md",
}: InlineEditActionsProps) {
  const icon = ACTION_SIZE[size];
  const pad = size === "sm" ? "p-0.5" : "p-1";
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || saveDisabled}
        aria-label={`${label}を保存`}
        className={cn(
          pad,
          "text-teal-600 transition-colors hover:text-teal-800 disabled:opacity-40",
        )}
      >
        {saving ? <Loader2 size={icon} className="animate-spin" /> : <Check size={icon} />}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        aria-label={`${label}の編集をキャンセル`}
        className={cn(
          pad,
          "text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40",
        )}
      >
        <X size={icon} />
      </button>
    </span>
  );
}
