"use client";

import { useRef, useState } from "react";
import { Minus, Pencil, Plus, UserPlus, X } from "lucide-react";
import {
  DndContext, DragOverlay, pointerWithin, rectIntersection, closestCenter, useSensor, useSensors, PointerSensor,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  concertsApi,
  type AssignmentDetail,
  type FormationBoxDetail,
  type FormationPatternDetail,
  type FormationSlotDetail,
  type PianoPosition,
} from "@/lib/concerts-api";
import { GridCell, PartColorLegend, SeatContainer } from "./Chips";
import { AddBoxPopover, AddMemberPopover } from "./Popovers";
import { useHoverPinPopover } from "./useHoverPinPopover";
import {
  GRID_STAGGER_OFFSET,
  assignmentToSlotItem, boxDisplayTitle, buildPlacedState, buildSlotsPayload, displayLabelOf, findContainer,
  isItemId, isRiserRow, parseCellId, removeMemberFromRisers, riserRowKeys, rowKey, rowNumOf, toFormationDetails,
} from "./formation-model";
import type { BoxMeta, Containers, PartColor, SlotItem } from "./types";

type NameEditTarget = { type: "item"; key: string } | { type: "box"; key: string };

export function FormationEditor({
  org, concertId, stageId, pattern, stageAssignments, partColorMap, onFormationChanged, onIsStaggeredChanged, onPianoPositionChanged,
}: {
  org: string;
  concertId: string;
  stageId: string;
  pattern: FormationPatternDetail;
  stageAssignments: AssignmentDetail[];
  partColorMap: Map<string, PartColor>;
  onFormationChanged: (boxes: FormationBoxDetail[], slots: FormationSlotDetail[]) => void;
  onIsStaggeredChanged: (isStaggered: boolean) => void;
  onPianoPositionChanged: (position: PianoPosition) => void;
}) {
  const [initial] = useState(() => buildPlacedState(pattern, 2));
  const [placed, setPlaced] = useState<Containers>(initial.placed);
  const [boxes, setBoxes] = useState<BoxMeta[]>(initial.boxes);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addMemberPopoverRef = useRef<HTMLDivElement>(null);
  const addMemberPopover = useHoverPinPopover(addMemberPopoverRef);
  const addBoxPopoverRef = useRef<HTMLDivElement>(null);
  const addBoxPopover = useHoverPinPopover(addBoxPopoverRef);
  const [nameEdit, setNameEdit] = useState<{ target: NameEditTarget; x: number; y: number; value: string } | null>(null);
  const [memberLabels, setMemberLabels] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    pattern.slots.forEach((s) => { if (s.memberId && s.label) map[s.memberId] = s.label; });
    return map;
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const conductorBox = boxes.find((b) => b.kind === "conductor");
  const pianoBox = boxes.find((b) => b.kind === "piano");
  const customBoxes = boxes.filter((b) => b.kind === "custom");
  // 指揮・ピアノ枠は「山台と同時配置不可」の対象。custom 枠は対象外
  const isExclusiveBoxKey = (key: string) => key === conductorBox?.key || key === pianoBox?.key;

  const exclusivePlacementMemberIds = new Set(
    Object.entries(placed)
      .filter(([key]) => isRiserRow(key) || isExclusiveBoxKey(key))
      .flatMap(([, items]) => items.filter((i) => i.memberId).map((i) => i.memberId as string))
  );
  const unassignedMembers: SlotItem[] = stageAssignments
    .filter((a) => a.status === "on" && !exclusivePlacementMemberIds.has(a.memberId))
    .map((a) => assignmentToSlotItem(a, memberLabels[a.memberId] ?? null));

  // アイテム→コンテナの逆引きMap（毎回 findContainer で全走査するのを避ける）
  const itemToContainer = new Map<string, string>();
  Object.entries(placed).forEach(([key, items]) => {
    items.forEach((item) => itemToContainer.set(item.key, key));
  });
  unassignedMembers.forEach((item) => itemToContainer.set(item.key, "unassigned"));
  const containerIdOf = (key: string): string | undefined => itemToContainer.get(key);

  // closestCenter 単独だと隣接コンテナで距離計算がずれるため pointerWithin を優先。
  // ドラッグ中の要素自身は候補から除外する（元の位置に残るため自分に当たって何も起きなくなる）
  const collisionDetection: CollisionDetection = (args) => {
    const otherContainers = args.droppableContainers.filter((c) => c.id !== args.active.id);
    const pointerCollisions = pointerWithin({ ...args, droppableContainers: otherContainers });

    const itemCollisions = pointerCollisions.filter((c) => isItemId(c.id));
    if (itemCollisions.length > 0) return itemCollisions;

    // チップに重なっていなくても、コンテナ内の最も近いチップを挿入先にする（末尾固定を避ける）
    const containerHit = pointerCollisions.find((c) => !isItemId(c.id));
    if (containerHit) {
      const sameContainerItems = otherContainers.filter(
        (c) => isItemId(c.id) && containerIdOf(String(c.id)) === containerHit.id
      );
      if (sameContainerItems.length > 0) {
        const closest = closestCenter({ ...args, droppableContainers: sameContainerItems });
        if (closest.length > 0) return closest;
      }
      return [containerHit];
    }

    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection({ ...args, droppableContainers: otherContainers });
  };

  const commit = (nextPlaced: Containers, nextBoxes: BoxMeta[] = boxes) => {
    const prevPlaced = placed;
    const prevBoxes = boxes;
    setPlaced(nextPlaced);
    setBoxes(nextBoxes);
    setError(null);
    concertsApi.saveFormationSlots(org, concertId, stageId, pattern.id, buildSlotsPayload(nextPlaced, nextBoxes))
      .then(() => {
        const { boxes: boxDetails, slots: slotDetails } = toFormationDetails(nextPlaced, nextBoxes);
        onFormationChanged(boxDetails, slotDetails);
      })
      .catch(() => {
        setPlaced(prevPlaced);
        setBoxes(prevBoxes);
        setError("フォーメーションの保存に失敗しました。もう一度お試しください。");
      });
  };

  const createBox = (title: string) => {
    const newBox: BoxMeta = {
      key: `box:${crypto.randomUUID()}`,
      kind: "custom",
      title,
      sortOrder: Math.max(0, ...boxes.map((b) => b.sortOrder)) + 1,
    };
    commit({ ...placed, [newBox.key]: [] }, [...boxes, newBox]);
    addBoxPopover.close();
  };

  const placeMemberInBox = (boxKey: string, member: AssignmentDetail) => {
    const item: SlotItem = {
      key: `i:${crypto.randomUUID()}`, memberId: member.memberId,
      label: memberLabels[member.memberId] ?? null, name: member.nameJa, partName: member.partName,
    };
    let next: Containers = { ...placed, [boxKey]: [...(placed[boxKey] ?? []), item] };
    if (isExclusiveBoxKey(boxKey)) {
      next = removeMemberFromRisers(next, member.memberId);
    }
    commit(next);
    addMemberPopover.close();
  };

  // 客演など団員外の出演者は memberId を持たず、名前を label にそのまま保持する
  const placeGuestInBox = (boxKey: string, name: string) => {
    const item: SlotItem = { key: `i:${crypto.randomUUID()}`, memberId: null, label: name, name, partName: null };
    commit({ ...placed, [boxKey]: [...(placed[boxKey] ?? []), item] });
    addMemberPopover.close();
  };

  const removeBox = (boxKey: string) => {
    const next = { ...placed };
    delete next[boxKey];
    commit(next, boxes.filter((b) => b.key !== boxKey));
  };

  const openNameEdit = (item: SlotItem, e: React.MouseEvent) => {
    setNameEdit({ target: { type: "item", key: item.key }, x: e.clientX, y: e.clientY, value: displayLabelOf(item) });
  };

  const openBoxRename = (boxKey: string, e: React.MouseEvent) => {
    const box = boxes.find((b) => b.key === boxKey);
    if (!box) return;
    setNameEdit({ target: { type: "box", key: boxKey }, x: e.clientX, y: e.clientY, value: box.title ?? "" });
  };

  // 団員は label のみ上書き（空なら自動表示に戻す）。客演・指揮者名は label と name を同時更新
  const saveNameEdit = (value: string) => {
    if (!nameEdit) return;
    const trimmed = value.trim();

    if (nameEdit.target.type === "box") {
      if (!trimmed) { setNameEdit(null); return; }
      const boxKey = nameEdit.target.key;
      commit(placed, boxes.map((b) => (b.key === boxKey ? { ...b, title: trimmed } : b)));
      setNameEdit(null);
      return;
    }

    const itemKey = nameEdit.target.key;
    const rowKeyFound = findContainer(placed, itemKey);
    const target = rowKeyFound ? placed[rowKeyFound].find((i) => i.key === itemKey) : undefined;
    if (!rowKeyFound || !target) { setNameEdit(null); return; }
    if (!target.memberId && !trimmed) { setNameEdit(null); return; }
    if (target.memberId) {
      const memberId = target.memberId;
      setMemberLabels((prev) => {
        const next = { ...prev };
        if (trimmed) next[memberId] = trimmed;
        else delete next[memberId];
        return next;
      });
      commit({
        ...placed,
        [rowKeyFound]: placed[rowKeyFound].map((i) => (i.key === itemKey ? { ...i, label: trimmed || null } : i)),
      });
    } else {
      commit({
        ...placed,
        [rowKeyFound]: placed[rowKeyFound].map((i) => (i.key === itemKey ? { ...i, label: trimmed, name: trimmed } : i)),
      });
    }
    setNameEdit(null);
  };

  const removeItem = (key: string) => {
    const rowKeyFound = findContainer(placed, key);
    if (!rowKeyFound) return;
    commit({ ...placed, [rowKeyFound]: placed[rowKeyFound].filter((i) => i.key !== key) });
  };

  const addRow = () => {
    const rowKeys = riserRowKeys(placed);
    const maxRowNum = rowKeys.length > 0 ? Math.max(...rowKeys.map(rowNumOf)) : 0;
    setPlaced({ ...placed, [rowKey(maxRowNum + 1)]: [] });
  };

  const removeLastRow = () => {
    const rowKeys = riserRowKeys(placed);
    if (rowKeys.length <= 1) return;
    const lastKey = rowKeys[rowKeys.length - 1];
    const next = { ...placed };
    delete next[lastKey];
    // メンバーがいた場合は「未配置」に戻る変更として保存する
    if (placed[lastKey].length > 0) commit(next); else setPlaced(next);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  type ItemLocation = { kind: "pool" } | { kind: "box"; key: string } | { kind: "grid"; row: string; col: number };
  const locateItem = (key: string): ItemLocation | null => {
    if (unassignedMembers.some((i) => i.key === key)) return { kind: "pool" };
    const row = findContainer(placed, key);
    if (!row) return null;
    if (isRiserRow(row)) {
      const found = placed[row].find((i) => i.key === key)!;
      return { kind: "grid", row, col: found.col ?? 1 };
    }
    return { kind: "box", key: row };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeKey = active.id as string;
    const overKey = over.id as string;
    const overCell = parseCellId(overKey);

    const source = locateItem(activeKey);
    if (!source) return;

    // プール由来なら m:memberId は使い回さず新しい一意キーを発行する（同じ団員を複数配置できるように）
    const sourceKey = source.kind === "grid" ? source.row : source.kind === "box" ? source.key : null;
    const draggedItem: SlotItem = source.kind === "pool"
      ? { ...unassignedMembers.find((i) => i.key === activeKey)!, key: `i:${crypto.randomUUID()}` }
      : placed[sourceKey as string].find((i) => i.key === activeKey)!;

    const withoutSource = (containers: Containers): Containers => {
      const next = { ...containers };
      if (source.kind !== "pool") {
        next[sourceKey as string] = next[sourceKey as string].filter((i) => i.key !== activeKey);
      }
      return next;
    };

    if (overCell) {
      const { row: targetRow, col: targetCol } = overCell;
      if (source.kind === "grid" && source.row === targetRow && source.col === targetCol) return;

      const occupant = (placed[targetRow] ?? []).find((i) => i.col === targetCol && i.key !== activeKey);

      const next: Containers = withoutSource(placed);
      if (occupant) {
        next[targetRow] = (next[targetRow] ?? []).filter((i) => i.key !== occupant.key);
        if (source.kind === "grid") {
          // 山台同士の入れ替え: 元いた人をドラッグ元のマスに収める
          next[source.row] = [...(next[source.row] ?? []), { ...occupant, col: source.col }];
        }
        // grid 以外から来た場合、押し出された人はどこにも配置されず「未配置」に戻る
      }
      next[targetRow] = [...(next[targetRow] ?? []), { ...draggedItem, col: targetCol }];
      commit(next);
      return;
    }

    const isOverUnassigned = overKey === "unassigned" || unassignedMembers.some((i) => i.key === overKey);
    const targetKey = isOverUnassigned ? "unassigned" : (overKey in placed ? overKey : findContainer(placed, overKey));
    if (!targetKey) return;
    if (source.kind === "pool" && targetKey === "unassigned") return;

    if (source.kind === "box" && source.key === targetKey) {
      const items = placed[source.key];
      const activeIndex = items.findIndex((i) => i.key === activeKey);
      const overIndex = items.findIndex((i) => i.key === overKey);
      if (overIndex === -1 || activeIndex === overIndex) return;
      commit({ ...placed, [source.key]: arrayMove(items, activeIndex, overIndex) });
      return;
    }

    let next: Containers = withoutSource(placed);
    if (targetKey !== "unassigned") {
      const overItems = [...(next[targetKey] ?? [])];
      let overIndex = overItems.findIndex((i) => i.key === overKey);
      if (overIndex === -1) {
        overIndex = overItems.length;
      } else {
        // 対象チップの中心より右側でドロップした場合はその後ろに挿入する
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;
        if (activeRect && activeRect.left + activeRect.width / 2 > overRect.left + overRect.width / 2) {
          overIndex += 1;
        }
      }
      overItems.splice(overIndex, 0, draggedItem);
      next[targetKey] = overItems;
    }
    if (draggedItem.memberId && isExclusiveBoxKey(targetKey)) {
      next = removeMemberFromRisers(next, draggedItem.memberId);
    }
    commit(next);
  };

  const rowKeys = riserRowKeys(placed);

  // グリッドの列数 = オンステ人数÷段数（切り上げ）。ただし既に配置済みの最大列を下回らない
  const totalOnStage = stageAssignments.filter((a) => a.status === "on").length;
  const computedColumnCount = Math.max(1, Math.ceil(totalOnStage / Math.max(rowKeys.length, 1)));
  const maxUsedCol = Math.max(0, ...rowKeys.flatMap((k) => (placed[k] ?? []).map((i) => i.col ?? 0)));
  const columnCount = Math.max(computedColumnCount, maxUsedCol);

  const renderBox = (boxKey: string) => {
    const box = boxes.find((b) => b.key === boxKey);
    if (!box) return null;
    const items = placed[boxKey] ?? [];
    const title = boxDisplayTitle(box);
    const isFixed = box.kind !== "custom";

    return (
      <div key={boxKey} className={isFixed ? "flex-1 min-w-0" : "min-w-0"}>
        {/* ピアノ枠だけ右側に中央/下手ボタンが入るため、高さを固定して指揮枠のヘッダーと揃える */}
        <div className="flex items-center justify-between gap-2 mb-1.5 h-6">
          <div className="flex items-center gap-3">
            <p className="text-xs font-medium text-gray-500">{title}</p>
            {!isFixed && (
              <>
                <button type="button" onClick={(e) => openBoxRename(boxKey, e)} className="text-gray-300 hover:text-gray-500 p-0.5" title="枠名を編集">
                  <Pencil size={10} />
                </button>
                <button type="button" onClick={() => removeBox(boxKey)} className="text-gray-300 hover:text-red-500 p-0.5" title="枠を削除">
                  <X size={11} />
                </button>
              </>
            )}
          </div>
          {box.kind === "piano" && (
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => onPianoPositionChanged("center")}
                className={`px-1.5 py-0.5 text-[10px] ${pattern.pianoPosition === "center" ? "bg-brand-600 text-white" : "bg-white text-gray-400"}`}
                title="中央（指揮者の前）。参照画面での表示位置に反映されます"
              >
                中央
              </button>
              <button
                type="button"
                onClick={() => onPianoPositionChanged("kamite")}
                className={`px-1.5 py-0.5 text-[10px] ${pattern.pianoPosition === "kamite" ? "bg-brand-600 text-white" : "bg-white text-gray-400"}`}
                title="指揮者の下手側。参照画面での表示位置に反映されます"
              >
                下手
              </button>
            </div>
          )}
        </div>
        <SeatContainer
          id={boxKey}
          items={items}
          placeholder="ドラッグ、または上の「メンバーを配置」から追加"
          partColorMap={partColorMap}
          chipProps={(item) => ({
            onEdit: (e) => openNameEdit(item, e),
            onRemove: () => removeItem(item.key),
            onTapRemove: item.memberId ? () => removeItem(item.key) : undefined,
          })}
        />
      </div>
    );
  };

  const boxOptions = boxes.map((b) => ({ key: b.key, title: boxDisplayTitle(b) }));

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">指揮・ピアノ他</p>
            <div className="flex items-center gap-2">
              <div className="relative" ref={addMemberPopoverRef} {...addMemberPopover.containerProps}>
                <button
                  type="button"
                  {...addMemberPopover.triggerProps}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 border border-gray-200 rounded-lg px-2 py-1 bg-white"
                >
                  <UserPlus size={12} /> メンバーを配置
                </button>
                {addMemberPopover.isOpen && (
                  <AddMemberPopover
                    boxes={boxOptions}
                    onConfirmedMembers={stageAssignments.filter((a) => a.status === "on")}
                    getExistingMemberIds={(boxKey) => new Set((placed[boxKey] ?? []).filter((i) => i.memberId).map((i) => i.memberId as string))}
                    onPlaceMember={placeMemberInBox}
                    onPlaceGuest={placeGuestInBox}
                  />
                )}
              </div>
              <div className="relative" ref={addBoxPopoverRef} {...addBoxPopover.containerProps}>
                <button
                  type="button"
                  {...addBoxPopover.triggerProps}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 border border-gray-200 rounded-lg px-2 py-1 bg-white"
                >
                  <Plus size={12} /> 枠を追加
                </button>
                {addBoxPopover.isOpen && (
                  <AddBoxPopover onCreateBox={createBox} />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {conductorBox && renderBox(conductorBox.key)}
            {pianoBox && renderBox(pianoBox.key)}
          </div>
          {customBoxes.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {customBoxes.map((b) => renderBox(b.key))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500">ステージ</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-medium text-gray-500">空いているマスにもドラッグで配置できます</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={pattern.isStaggered}
                    onClick={() => onIsStaggeredChanged(!pattern.isStaggered)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pattern.isStaggered ? "bg-brand-600" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pattern.isStaggered ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  半人分ずらす
                </label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={removeLastRow} className="text-gray-400 hover:text-gray-600 p-1 border border-gray-200 rounded bg-white" title="末尾の段を減らす">
                    <Minus size={12} />
                  </button>
                  <span className="text-xs text-gray-400 w-6 text-center">{rowKeys.length}段</span>
                  <button type="button" onClick={addRow} className="text-gray-400 hover:text-gray-600 p-1 border border-gray-200 rounded bg-white" title="段を追加">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
            <PartColorLegend partColorMap={partColorMap} />
            <div className="space-y-2 overflow-x-auto pb-1">
              {rowKeys.map((row, idx) => {
                const isOffsetRow = pattern.isStaggered && idx % 2 === 1;
                // transform はレイアウト計算に影響しないため、中央寄せ後に見た目だけを半マス分ずらせる
                return (
                  <div key={row} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-10 shrink-0 truncate">{idx + 1}段目</span>
                    <div className="flex-1 flex justify-center">
                      <div className="flex gap-2" style={isOffsetRow ? { transform: `translateX(${GRID_STAGGER_OFFSET}px)` } : undefined}>
                        {Array.from({ length: columnCount }, (_, i) => i + 1).map((col) => (
                          <GridCell
                            key={col}
                            row={row}
                            col={col}
                            item={(placed[row] ?? []).find((i) => i.col === col)}
                            partColorMap={partColorMap}
                            onTapRemove={(item) => removeItem(item.key)}
                            onEdit={(item, e) => openNameEdit(item, e)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">未配置</p>
            <SeatContainer
              id="unassigned"
              items={unassignedMembers}
              partColorMap={partColorMap}
            />
          </div>
        </div>
      </div>
      <DragOverlay>
        {(() => {
          if (!activeId) return null;
          const item = [...Object.values(placed).flat(), ...unassignedMembers].find((i) => i.key === activeId);
          if (!item) return null;
          const color = item.partName ? partColorMap.get(item.partName) : undefined;
          const bg = color?.bg ?? "bg-green-50";
          const border = color?.border ?? "border-green-200";
          return (
            <span className={`relative w-11 h-11 rounded-full border-2 ${bg} ${border} shadow-lg`}>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-gray-700 leading-none whitespace-nowrap">
                {displayLabelOf(item)}
              </span>
            </span>
          );
        })()}
      </DragOverlay>
      {nameEdit && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setNameEdit(null)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-56"
            style={{ left: nameEdit.x, top: nameEdit.y }}
          >
            <p className="text-xs text-gray-500 mb-2">
              {nameEdit.target.type === "box" ? "枠名を編集" : "丸の中の表示名を編集（1〜3文字）"}
            </p>
            <input
              autoFocus
              type="text"
              value={nameEdit.value}
              onChange={(e) => setNameEdit({ ...nameEdit, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") saveNameEdit(nameEdit.value); if (e.key === "Escape") setNameEdit(null); }}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mb-2 focus:outline-none focus:border-brand-300"
            />
            <button
              type="button"
              onClick={() => saveNameEdit(nameEdit.value)}
              className="w-full text-xs bg-brand-600 text-white py-1.5 rounded-lg hover:bg-brand-700"
            >
              保存
            </button>
          </div>
        </>
      )}
    </DndContext>
  );
}
