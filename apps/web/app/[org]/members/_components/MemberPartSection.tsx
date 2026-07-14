import type { MemberProfile } from "@/lib/members-api";
import { MemberCard, MemberRow } from "./MemberCard";

interface MemberPartSectionProps {
  partId: string;
  partName: string;
  members: MemberProfile[];
  viewMode: "card" | "list";
  org: string;
}

export function MemberPartSection({
  partId,
  partName,
  members,
  viewMode,
  org,
}: MemberPartSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h2
          className={`text-sm font-semibold ${partId === "__unassigned__" ? "text-gray-400" : "text-gray-700"}`}
        >
          {partName}
        </h2>
        <span className="text-xs text-gray-400">{members.length}名</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {viewMode === "card" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} org={org} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} org={org} />
          ))}
        </div>
      )}
    </section>
  );
}
