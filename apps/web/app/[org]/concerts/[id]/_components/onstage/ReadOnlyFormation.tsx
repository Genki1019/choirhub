import type { FormationPatternDetail } from "@/lib/concerts-api";
import { PartColorLegend, ReadOnlyChip } from "./Chips";
import { GRID_CELL_STEP, GRID_STAGGER_OFFSET, buildPlacedState, riserRowKeys } from "./formation-model";
import type { PartColor } from "./types";

export function ReadOnlyFormation({
  pattern, partColorMap,
}: {
  pattern: FormationPatternDetail;
  partColorMap: Map<string, PartColor>;
}) {
  const { placed: containers, boxes } = buildPlacedState(pattern, 1);
  const rowKeys = riserRowKeys(containers).filter((k) => containers[k].length > 0);
  const conductorBox = boxes.find((b) => b.kind === "conductor");
  const pianoBox = boxes.find((b) => b.kind === "piano");
  const customBoxes = boxes.filter((b) => b.kind === "custom");
  const conductor = conductorBox ? (containers[conductorBox.key] ?? []) : [];
  const piano = pianoBox ? (containers[pianoBox.key] ?? []) : [];

  // 未使用の空き列まで中央計算に含めると指揮者の位置がズレるため、実際に使われている
  // 列の範囲（最小列〜最大列）だけを描画する
  const usedCols = rowKeys.flatMap((k) => containers[k].map((i) => i.col).filter((c): c is number => c != null));
  const minCol = usedCols.length > 0 ? Math.min(...usedCols) : 1;
  const maxCol = usedCols.length > 0 ? Math.max(...usedCols) : 1;
  const visibleColumnCount = maxCol - minCol + 1;
  const stageContentWidth = visibleColumnCount * GRID_CELL_STEP - 8;

  if (rowKeys.length === 0 && conductor.length === 0 && piano.length === 0 && customBoxes.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">フォーメーションはまだ設定されていません</p>;
  }

  return (
    <div className="space-y-3">
      {(conductor.length > 0 || piano.length > 0 || rowKeys.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500">ステージ</p>
          <PartColorLegend partColorMap={partColorMap} />
          {/* transform はレイアウト計算に影響しないため、中央寄せ後に見た目だけを半マス分ずらせる */}
          <div className="space-y-2 overflow-x-auto pb-1">
            {conductor.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-10 shrink-0 truncate">指揮</span>
                <div className="flex-1 flex justify-center">
                  <div className="flex gap-2">
                    {conductor.map((item) => (
                      <ReadOnlyChip key={item.key} item={item} colorClass={item.partName ? partColorMap.get(item.partName) : undefined} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {piano.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-10 shrink-0 truncate">ピアノ</span>
                <div className="flex-1 flex justify-center">
                  <div
                    className="flex gap-2"
                    style={pattern.pianoPosition === "kamite" ? { transform: `translateX(${stageContentWidth / 4}px)` } : undefined}
                  >
                    {piano.map((item) => (
                      <ReadOnlyChip key={item.key} item={item} colorClass={item.partName ? partColorMap.get(item.partName) : undefined} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {rowKeys.map((key, idx) => {
              const isOffsetRow = pattern.isStaggered && idx % 2 === 1;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-10 shrink-0 truncate">{idx + 1}段目</span>
                  <div className="flex-1 flex justify-center">
                    <div className="flex gap-2" style={isOffsetRow ? { transform: `translateX(${GRID_STAGGER_OFFSET}px)` } : undefined}>
                      {Array.from({ length: visibleColumnCount }, (_, i) => minCol + i).map((col) => {
                        const item = containers[key].find((i) => i.col === col);
                        return item ? (
                          <ReadOnlyChip key={col} item={item} colorClass={item.partName ? partColorMap.get(item.partName) : undefined} />
                        ) : (
                          <div key={col} className="w-11 h-11 rounded-full border border-dashed border-gray-300 flex-none" />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {customBoxes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500">ソロ・楽器</p>
          <div className="grid grid-cols-2 gap-3">
            {customBoxes.map((box) => {
              const occupants = containers[box.key] ?? [];
              return (
                <div key={box.key} className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-400 shrink-0 truncate">{box.title}</span>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {occupants.length === 0 && <span className="text-xs text-gray-300">（未配置）</span>}
                    {occupants.map((item) => (
                      <ReadOnlyChip key={item.key} item={item} colorClass={item.partName ? partColorMap.get(item.partName) : undefined} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
