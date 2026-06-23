import { Users } from "lucide-react";
import { type ConcertDetail, type AssignmentDetail } from "@/lib/concerts-api";
import { comparePartOrder } from "@/lib/voice-order";

interface OnstageTabProps {
  concert: ConcertDetail;
}

export function OnstageTab({ concert }: OnstageTabProps) {
  const { assignments } = concert;

  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">出演メンバーがまだ登録されていません</p>
      </div>
    );
  }

  const onMembers  = assignments.filter((a) => a.status === "on");
  const offMembers = assignments.filter((a) => a.status === "off");

  const partMap = new Map<string, { partName: string; sortOrder: number; voiceType: string; members: AssignmentDetail[] }>();
  onMembers.forEach((a) => {
    const key = a.partId ?? "__none__";
    if (!partMap.has(key)) {
      partMap.set(key, { partName: a.partName ?? "パート未設定", sortOrder: a.partSortOrder, voiceType: a.partVoiceType, members: [] });
    }
    partMap.get(key)!.members.push(a);
  });
  const sortedGroups = Array.from(partMap.values()).sort((a, b) =>
    comparePartOrder({ voiceType: a.voiceType, sortOrder: a.sortOrder }, { voiceType: b.voiceType, sortOrder: b.sortOrder })
  );

  return (
    <div className="space-y-6">
      {onMembers.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-700">出演確定</h3>
            <span className="text-xs text-gray-400">{onMembers.length}名</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="space-y-3">
            {sortedGroups.map(({ partName, members }) => (
              <div key={partName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">{partName}</span>
                  <span className="text-xs text-gray-400">{members.length}名</span>
                </div>
                <div className="px-5 py-3 flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span key={m.memberId} className="text-sm text-gray-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
                      {m.nameJa}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {offMembers.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-500">出演なし</h3>
            <span className="text-xs text-gray-400">{offMembers.length}名</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex flex-wrap gap-2">
            {offMembers.map((m) => (
              <span key={m.memberId} className="text-sm text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                {m.nameJa}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
