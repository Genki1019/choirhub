"use client";

import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function useListDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return {
    setNodeRef,
    attributes,
    listeners,
    isDragging,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
    },
  };
}

export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (row: ReturnType<typeof useSortableRow>) => ReactNode;
}) {
  const row = useSortableRow(id);
  return children(row);
}

export function DragHandle({
  label,
  attributes,
  listeners,
  disabled,
}: {
  label: string;
  attributes: ReturnType<typeof useSortableRow>["attributes"];
  listeners: ReturnType<typeof useSortableRow>["listeners"];
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={`${label}をドラッグして並び替え`}
      className="touch-none p-1.5 text-gray-300 transition-colors hover:text-gray-500 disabled:opacity-20"
    >
      <GripVertical size={14} />
    </button>
  );
}
