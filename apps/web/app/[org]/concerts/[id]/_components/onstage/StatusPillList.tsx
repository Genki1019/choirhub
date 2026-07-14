import type { AssignmentDetail } from "@/lib/concerts-api";
import { ReadOnlyChip } from "./Chips";
import { assignmentToSlotItem } from "./formation-model";
import type { PartColor } from "./types";

export function StatusPillList({
  title, members, partColorMap,
}: {
  title: string;
  members: AssignmentDetail[];
  partColorMap: Map<string, PartColor>;
}) {
  if (members.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-500">{title}</h3>
        <span className="text-xs text-gray-400">{members.length}名</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex flex-wrap gap-2">
        {members.map((m) => (
          <ReadOnlyChip
            key={m.memberId}
            item={assignmentToSlotItem(m)}
            colorClass={m.partName ? partColorMap.get(m.partName) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
