"use client";

import { Pencil, X } from "lucide-react";
import {
  useDroppable,
  useDraggable,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CHIP_SIZE_PX, cellId, displayLabelOf } from "./formation-model";
import type { PartColor, SlotItem } from "./types";

export function PartColorLegend({ partColorMap }: { partColorMap: Map<string, PartColor> }) {
  if (partColorMap.size === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {[...partColorMap.entries()].map(([partName, color]) => (
        <span key={partName} className="flex items-center gap-1 text-[11px] text-gray-600">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full border ${color.bg} ${color.border}`}
          />
          {partName}
        </span>
      ))}
    </div>
  );
}

// SeatChip と GridChip が共通で使う見た目部分。ドラッグ用の hook はそれぞれ異なるためdragProps として受け取る
function ChipBody({
  dragProps,
  label,
  fullName,
  colorClass,
  disabled,
  onTapRemove,
  onEdit,
  onRemove,
}: {
  dragProps: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
  };
  label: string;
  fullName: string;
  colorClass?: PartColor;
  disabled?: boolean;
  onTapRemove?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, style } = dragProps;
  const bg = colorClass?.bg ?? "bg-green-50";
  const border = colorClass?.border ?? "border-green-200";
  const tooltip = onTapRemove ? `${fullName}（クリックで未配置に戻す）` : fullName;
  return (
    <span ref={setNodeRef} style={style} className="relative inline-flex select-none">
      <span
        {...attributes}
        {...listeners}
        onClick={onTapRemove}
        title={tooltip}
        className={[
          "relative h-11 w-11 flex-none rounded-full border-2",
          bg,
          border,
          disabled ? "" : "cursor-grab active:cursor-grabbing",
          onTapRemove ? "cursor-pointer" : "",
        ].join(" ")}
      >
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs leading-none font-semibold whitespace-nowrap text-gray-700">
          {label}
        </span>
      </span>
      {!disabled && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="hover:text-brand-600 absolute -top-1 -right-1 z-10 rounded-full border border-gray-200 bg-white p-0.5 text-gray-400 shadow-sm"
          title="表示名を編集"
        >
          <Pencil size={9} />
        </button>
      )}
      {!disabled && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1 -bottom-1 z-10 rounded-full border border-gray-200 bg-white p-0.5 text-gray-300 shadow-sm hover:text-red-500"
          title="削除"
        >
          <X size={9} />
        </button>
      )}
    </span>
  );
}

export function SeatChip({
  id,
  label,
  fullName,
  colorClass,
  disabled,
  onTapRemove,
  onEdit,
  onRemove,
}: {
  id: string;
  label: string;
  fullName: string;
  colorClass?: PartColor;
  disabled?: boolean;
  onTapRemove?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <ChipBody
      dragProps={{ attributes, listeners, setNodeRef, style }}
      label={label}
      fullName={fullName}
      colorClass={colorClass}
      disabled={disabled}
      onTapRemove={onTapRemove}
      onEdit={onEdit}
      onRemove={onRemove}
    />
  );
}

export function SeatContainer({
  id,
  items,
  placeholder,
  disabled,
  partColorMap,
  chipProps,
}: {
  id: string;
  items: SlotItem[];
  placeholder?: string;
  disabled?: boolean;
  partColorMap?: Map<string, PartColor>;
  chipProps?: (
    item: SlotItem,
  ) => Omit<
    Parameters<typeof SeatChip>[0],
    "id" | "label" | "fullName" | "colorClass" | "disabled"
  >;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const keys = items.map((i) => i.key);
  return (
    <div
      ref={setNodeRef}
      style={{ minHeight: CHIP_SIZE_PX + 16 /* + py-2 (8px 上下) */ }}
      className={[
        "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
        isOver ? "border-brand-300 bg-brand-50/40" : "border-dashed border-gray-300",
      ].join(" ")}
    >
      <SortableContext items={keys} strategy={horizontalListSortingStrategy}>
        {items.length === 0 && placeholder && (
          <span className="text-xs text-gray-400">{placeholder}</span>
        )}
        {items.map((item) => (
          <SeatChip
            key={item.key}
            id={item.key}
            label={displayLabelOf(item)}
            fullName={item.name}
            colorClass={item.partName ? partColorMap?.get(item.partName) : undefined}
            disabled={disabled}
            {...(chipProps ? chipProps(item) : {})}
          />
        ))}
      </SortableContext>
    </div>
  );
}

// 山台のマス上のチップ。ソート済みリストではなく行×列のグリッドなので、並び替えの前提を持つ useSortable ではなく単純な useDraggable を使う
export function GridChip({
  id,
  label,
  fullName,
  colorClass,
  onTapRemove,
  onEdit,
}: {
  id: string;
  label: string;
  fullName: string;
  colorClass?: PartColor;
  onTapRemove?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 };
  return (
    <ChipBody
      dragProps={{ attributes, listeners, setNodeRef, style }}
      label={label}
      fullName={fullName}
      colorClass={colorClass}
      onTapRemove={onTapRemove}
      onEdit={onEdit}
    />
  );
}

export function GridCell({
  row,
  col,
  item,
  partColorMap,
  onTapRemove,
  onEdit,
}: {
  row: string;
  col: number;
  item: SlotItem | undefined;
  partColorMap?: Map<string, PartColor>;
  onTapRemove?: (item: SlotItem) => void;
  onEdit?: (item: SlotItem, e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId(row, col) });

  if (!item) {
    return (
      <div
        ref={setNodeRef}
        className={[
          "h-11 w-11 flex-none rounded-full border transition-colors",
          isOver ? "border-brand-400 bg-brand-50" : "border-dashed border-gray-300",
        ].join(" ")}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`relative h-11 w-11 flex-none rounded-full ${isOver ? "ring-brand-400 ring-2" : ""}`}
    >
      <GridChip
        id={item.key}
        label={displayLabelOf(item)}
        fullName={item.name}
        colorClass={item.partName ? partColorMap?.get(item.partName) : undefined}
        onTapRemove={onTapRemove ? () => onTapRemove(item) : undefined}
        onEdit={onEdit ? (e) => onEdit(item, e) : undefined}
      />
    </div>
  );
}

export function ReadOnlyChip({ item, colorClass }: { item: SlotItem; colorClass?: PartColor }) {
  const bg = colorClass?.bg ?? "bg-green-50";
  const border = colorClass?.border ?? "border-green-200";
  return (
    <span className={`relative h-11 w-11 rounded-full border-2 ${bg} ${border}`} title={item.name}>
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs leading-none font-semibold whitespace-nowrap text-gray-700">
        {displayLabelOf(item)}
      </span>
    </span>
  );
}
