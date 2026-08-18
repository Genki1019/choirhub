import { describe, it, expect, vi } from "vitest";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  computeSortOrderPatches,
  createSortDragEndHandler,
  reorderByDragEvent,
} from "../sort-order";

interface Item {
  id: string;
  sortOrder: number;
}

function makeItems(): Item[] {
  return [
    { id: "a", sortOrder: 1 },
    { id: "b", sortOrder: 2 },
    { id: "c", sortOrder: 3 },
  ];
}

function dragEvent(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId ? { id: overId } : null,
  } as DragEndEvent;
}

describe("computeSortOrderPatches", () => {
  it("sortOrderが変わった行だけを返す", () => {
    const before = makeItems();
    const after = [
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ];

    expect(computeSortOrderPatches(before, after)).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
    ]);
  });

  it("変化がなければ空配列を返す", () => {
    const before = makeItems();
    expect(computeSortOrderPatches(before, before)).toEqual([]);
  });

  it("全件変化していれば全件返す", () => {
    const before = makeItems();
    const after = [
      { id: "c", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
      { id: "b", sortOrder: 3 },
    ];
    expect(computeSortOrderPatches(before, after)).toEqual(after);
  });
});

describe("reorderByDragEvent", () => {
  it("over が無い場合はnullを返す", () => {
    expect(reorderByDragEvent(makeItems(), dragEvent("a", null))).toBeNull();
  });

  it("同じ位置にドロップした場合はnullを返す", () => {
    expect(reorderByDragEvent(makeItems(), dragEvent("a", "a"))).toBeNull();
  });

  it("id/sortOrder以外のフィールドを持たない要素でも並び替えられる（StagesTabのようなsortOrderなし用途）", () => {
    const items = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
    expect(reorderByDragEvent(items, dragEvent("s1", "s3"))).toEqual([
      { id: "s2" },
      { id: "s3" },
      { id: "s1" },
    ]);
  });
});

describe("createSortDragEndHandler", () => {
  it("over が無い場合は何もしない", async () => {
    const onReordered = vi.fn();
    const persistOne = vi.fn();
    const onError = vi.fn();
    const setBusy = vi.fn();
    const handleDragEnd = createSortDragEndHandler({
      items: makeItems(),
      onReordered,
      persistOne,
      onError,
      setBusy,
    });

    await handleDragEnd(dragEvent("a", null));

    expect(onReordered).not.toHaveBeenCalled();
    expect(persistOne).not.toHaveBeenCalled();
    expect(setBusy).not.toHaveBeenCalled();
  });

  it("同じ位置にドロップした場合は何もしない", async () => {
    const onReordered = vi.fn();
    const persistOne = vi.fn();
    const handleDragEnd = createSortDragEndHandler({
      items: makeItems(),
      onReordered,
      persistOne,
      onError: vi.fn(),
      setBusy: vi.fn(),
    });

    await handleDragEnd(dragEvent("a", "a"));

    expect(onReordered).not.toHaveBeenCalled();
    expect(persistOne).not.toHaveBeenCalled();
  });

  it("並び替え成功時は変更があった行だけpersistOneを呼び、onReorderedで確定する", async () => {
    const onReordered = vi.fn();
    const persistOne = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const setBusy = vi.fn();
    const handleDragEnd = createSortDragEndHandler({
      items: makeItems(),
      onReordered,
      persistOne,
      onError,
      setBusy,
    });

    // a(1) を c(3) の位置までドラッグ → b, c, a の順に
    await handleDragEnd(dragEvent("a", "c"));

    expect(onReordered).toHaveBeenCalledWith([
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
      { id: "a", sortOrder: 3 },
    ]);
    expect(persistOne).toHaveBeenCalledTimes(3);
    expect(setBusy).toHaveBeenNthCalledWith(1, true);
    expect(setBusy).toHaveBeenNthCalledWith(2, false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("persistOneが失敗したら元の順序にロールバックしonErrorを呼ぶ", async () => {
    const onReordered = vi.fn();
    const persistOne = vi.fn().mockRejectedValue(new Error("network error"));
    const onError = vi.fn();
    const setBusy = vi.fn();
    const items = makeItems();
    const handleDragEnd = createSortDragEndHandler({
      items,
      onReordered,
      persistOne,
      onError,
      setBusy,
    });

    await handleDragEnd(dragEvent("a", "b"));

    expect(onReordered).toHaveBeenLastCalledWith(items);
    expect(onError).toHaveBeenCalledWith("並び替えに失敗しました");
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });
});
