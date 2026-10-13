"use client";

import { Tag } from "lucide-react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { InlineEditActions, InlineEditButton } from "@/components/InlineEdit";
import { useInlineEdit } from "@/hooks/useInlineEdit";

interface DistributionPriceFieldProps {
  price: number | null;
  canEdit: boolean;
  onSave: (price: number | null) => Promise<void>;
}

const toPrice = (value: string) => (value.trim() === "" ? null : Number(value.trim()));

export function DistributionPriceField({ price, canEdit, onSave }: DistributionPriceFieldProps) {
  const { registerTrigger, ...edit } = useInlineEdit({
    initial: () => (price !== null ? String(price) : ""),
    validate: (value) =>
      value.trim() === "" || /^\d+$/.test(value.trim())
        ? null
        : "価格は0以上の整数で入力してください",
    isEqual: (a, b) => toPrice(a) === toPrice(b),
    onSave: (value) => onSave(toPrice(value)),
    errorFallback: "配布価格の保存に失敗しました。もう一度お試しください。",
  });

  if (edit.editing) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">¥</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="配布価格"
            value={edit.value}
            onChange={(e) => edit.setValue(e.target.value)}
            onKeyDown={edit.handleKeyDown}
            className="focus:ring-brand-400 w-24 rounded border border-gray-200 px-1.5 py-0.5 text-xs focus:ring-1 focus:outline-none"
            autoFocus
            placeholder="例: 300"
          />
          <InlineEditActions
            label="配布価格"
            size="sm"
            saving={edit.saving}
            onSave={edit.save}
            onCancel={edit.cancel}
          />
        </div>
        <ErrorMessage className="mt-1">{edit.error}</ErrorMessage>
      </div>
    );
  }

  if (price !== null) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          <Tag size={10} />¥{price.toLocaleString()}
        </span>
        {canEdit && (
          <InlineEditButton ref={registerTrigger} label="配布価格" size="sm" onClick={edit.start} />
        )}
      </div>
    );
  }

  if (canEdit) {
    return (
      <button
        type="button"
        ref={registerTrigger}
        onClick={edit.start}
        className="hover:text-brand-500 text-xs text-gray-400 transition-colors"
      >
        + 価格を設定
      </button>
    );
  }

  return <span className="text-sm text-gray-400">未設定</span>;
}
