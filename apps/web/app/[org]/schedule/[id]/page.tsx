"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Lock, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { eventsApi, type EventDetail } from "@/lib/events-api";
import { membersApi, type MemberProfile, type PartSummary } from "@/lib/members-api";
import { comparePartOrder } from "@/lib/voice-order";
import { ApiClientError } from "@/lib/api-client";
import { AttendanceTable, type LocalAttendance } from "./_components/AttendanceTable";
import { DeleteConfirmModal } from "./_components/DeleteConfirmModal";

const STATUS_CYCLE = ["attending", "absent", "maybe", "undecided"] as const;

function formatDatetime(iso: string) {
  const d = new Date(iso);
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ScheduleDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();

  const [event,   setEvent]   = useState<EventDetail | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [parts,   setParts]   = useState<PartSummary[]>([]);
  const [selfId,  setSelfId]  = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [deleteError,       setDeleteError]       = useState<string | null>(null);

  const [attendances, setAttendances] = useState<Record<string, LocalAttendance>>({});
  const [saving,      setSaving]      = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      eventsApi.get(org, id),
      membersApi.me(org),
      membersApi.list(org, { status: "active" }),
      membersApi.parts(org),
    ])
      .then(([ev, me, memberList, partList]) => {
        setEvent(ev);
        setSelfId(me.id);
        setCanEdit(me.roles.includes("admin"));
        setMembers(memberList);
        setParts(partList);

        const map: Record<string, LocalAttendance> = {};
        const attMap = new Map(ev.attendances.map(a => [a.member.id, a]));
        memberList.forEach(m => {
          const rec = attMap.get(m.id);
          map[m.id] = {
            status:     rec?.status     ?? "undecided",
            arriveTime: rec?.arriveTime ?? null,
            leaveTime:  rec?.leaveTime  ?? null,
            dayMemo:    rec?.dayMemo    ?? null,
          };
        });
        setAttendances(map);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, id, router]);

  const isLocked = event?.isLocked ?? false;

  const cycleStatus = useCallback((memberId: string) => {
    if (isLocked || memberId !== selfId) return;
    setAttendances(prev => {
      const cur     = prev[memberId]?.status ?? "undecided";
      const next    = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      const updated = { ...prev[memberId], status: next };
      if (next === "maybe") setExpandedId(memberId);
      else setExpandedId(null);

      eventsApi.updateAttendance(org, id, {
        status:     next,
        arriveTime: updated.arriveTime,
        leaveTime:  updated.leaveTime,
        dayMemo:    updated.dayMemo,
      }).catch(() => {
        setAttendances(p => ({ ...p, [memberId]: prev[memberId] }));
      });

      return { ...prev, [memberId]: updated };
    });
  }, [isLocked, selfId, org, id]);

  const saveMemo = useCallback(async (memberId: string, data: Partial<LocalAttendance>) => {
    if (!selfId || memberId !== selfId) return;
    setSaving(true);
    const prev = attendances[memberId];
    const next = { ...prev, ...data };
    setAttendances(p => ({ ...p, [memberId]: next }));
    try {
      await eventsApi.updateAttendance(org, id, {
        status:     next.status,
        arriveTime: next.arriveTime,
        leaveTime:  next.leaveTime,
        dayMemo:    next.dayMemo,
      });
      setExpandedId(null);
    } catch {
      setAttendances(p => ({ ...p, [memberId]: prev }));
    } finally {
      setSaving(false);
    }
  }, [selfId, attendances, org, id]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await eventsApi.delete(org, id);
      router.push(`/${org}/schedule`);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "削除に失敗しました");
      setDeleting(false);
    }
  };

  const sortedParts = [...parts].sort(comparePartOrder);
  const partGroups  = sortedParts
    .map(part => ({ part, members: members.filter(m => m.part?.id === part.id) }))
    .filter(g => g.members.length > 0);
  const unassigned  = members.filter(m => !m.part);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 sm:px-8 py-4 bg-white border-b border-gray-200">
          <Link href={`/${org}/schedule`} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">イベント詳細</h1>
        </header>
        <div className="m-8 flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error ?? "イベントが見つかりません"}</span>
        </div>
      </div>
    );
  }

  const selfAnswered = attendances[selfId ?? ""]?.status !== "undecided";

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href={`/${org}/schedule`} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-800">{event.title}</h1>
              {isLocked && (
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  <Lock size={10} /> 締切済み
                </span>
              )}
              {!isLocked && selfAnswered && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                  回答済み
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-gray-400" />
                {formatDatetime(event.startsAt)}〜{new Date(event.endsAt).getHours()}:{String(new Date(event.endsAt).getMinutes()).padStart(2, "0")}
              </span>
              {event.location && (
                <a
                  href={event.locationUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <MapPin size={13} className="text-blue-400 shrink-0" />
                  {event.location}
                </a>
              )}
              {event.deadline && (
                <span className={new Date(event.deadline) < new Date() ? "text-red-400" : ""}>
                  締切: {formatDatetime(event.deadline)}
                </span>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/${org}/schedule/${id}/edit`}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={13} />
              編集
            </Link>
            <button
              onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              削除
            </button>
          </div>
        )}
      </header>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          title={event.title}
          deleting={deleting}
          error={deleteError}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      <main className="flex-1 px-4 sm:px-8 py-5 space-y-4">
        {event.pageMemo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">全体備考</p>
            <p className="text-sm text-gray-700 leading-relaxed">{event.pageMemo}</p>
          </div>
        )}

        <AttendanceTable
          partGroups={partGroups}
          unassigned={unassigned}
          attendances={attendances}
          selfId={selfId}
          isLocked={isLocked}
          expandedId={expandedId}
          saving={saving}
          onCycleStatus={cycleStatus}
          onSaveMemo={saveMemo}
          onSetExpandedId={setExpandedId}
        />

        {!isLocked && (
          <p className="text-xs text-gray-400 text-center">
            自分の行（青色）をクリックして出欠を回答してください。○ → ✕ → △ → — の順に切り替わります。
          </p>
        )}
      </main>
    </div>
  );
}
