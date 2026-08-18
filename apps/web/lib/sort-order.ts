import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

export function computeSortOrderPatches<T extends { id: string; sortOrder: number }>(
  before: T[],
  after: T[],
): T[] {
  const prevSortOrder = new Map(before.map((item) => [item.id, item.sortOrder]));
  return after.filter((item) => prevSortOrder.get(item.id) !== item.sortOrder);
}

// active/overの行が特定できない、または同じ位置へのドロップならnull（未変化）を返す
export function reorderByDragEvent<T extends { id: string }>(
  items: T[],
  event: DragEndEvent,
): T[] | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;
  const oldIndex = items.findIndex((item) => item.id === active.id);
  const newIndex = items.findIndex((item) => item.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return null;
  return arrayMove(items, oldIndex, newIndex);
}

export function createSortDragEndHandler<T extends { id: string; sortOrder: number }>({
  items,
  onReordered,
  persistOne,
  onError,
  setBusy,
}: {
  items: T[];
  onReordered: (items: T[]) => void;
  persistOne: (item: T) => Promise<unknown>;
  onError: (msg: string) => void;
  setBusy: (busy: boolean) => void;
}) {
  return async (event: DragEndEvent) => {
    const moved = reorderByDragEvent(items, event);
    if (!moved) return;
    const snapshot = items;
    const reindexed = moved.map((item, i) => ({ ...item, sortOrder: i + 1 }));
    const changed = computeSortOrderPatches(items, reindexed);
    onReordered(reindexed);
    setBusy(true);
    try {
      await Promise.all(changed.map(persistOne));
    } catch {
      onReordered(snapshot);
      onError("並び替えに失敗しました");
    } finally {
      setBusy(false);
    }
  };
}
