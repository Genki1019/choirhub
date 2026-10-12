import type { Ref } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditButtonProps {
  label: string;
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
}: InlineEditButtonProps) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label}を編集`}
      className={cn(
        "shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40",
        className,
      )}
    >
      <Pencil size={13} />
    </button>
  );
}

interface InlineEditActionsProps {
  label: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
}

export function InlineEditActions({
  label,
  saving,
  onSave,
  onCancel,
  saveDisabled,
}: InlineEditActionsProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || saveDisabled}
        aria-label={`${label}を保存`}
        className="p-1 text-teal-600 transition-colors hover:text-teal-800 disabled:opacity-40"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        aria-label={`${label}の編集をキャンセル`}
        className="p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-40"
      >
        <X size={14} />
      </button>
    </span>
  );
}
