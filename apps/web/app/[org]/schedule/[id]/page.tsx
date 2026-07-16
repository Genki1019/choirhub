"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Lock, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { comparePartOrder } from "@/lib/voice-order";
import { canManageSchedule } from "@/lib/roles";
import { eventKeys, memberKeys } from "@/lib/query-keys";
import { AttendanceTable, type LocalAttendance } from "./_components/AttendanceTable";
import { DeleteConfirmModal } from "./_components/DeleteConfirmModal";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

const STATUS_CYCLE = ["attending", "absent", "maybe", "undecided"] as const;

function formatDatetime(iso: string) {
  const d = new Date(iso);
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ScheduleDetailPage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();

  const { roles, memberId: selfId } = useMember();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [attendances, setAttendances] = useState<Record<string, LocalAttendance>>({});
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: eventKeys.detail(org, id),
    queryFn: () => eventsApi.get(org, id),
  });
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: memberKeys.activeList(org),
    queryFn: () => membersApi.list(org, { status: "active" }),
  });
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
  });

  const loading = eventLoading || membersLoading || partsLoading;

  // event + members が揃ったときだけ attendances を初期化する（同一イベントで再フェッチしても上書きしない）
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!event || !members.length || initializedForRef.current === id) return;
    const attMap = new Map(event.attendances.map((a) => [a.member.id, a]));
    const map: Record<string, LocalAttendance> = {};
    members.forEach((m) => {
      const rec = attMap.get(m.id);
      map[m.id] = {
        status: rec?.status ?? "undecided",
        arriveTime: rec?.arriveTime ?? null,
        leaveTime: rec?.leaveTime ?? null,
        dayMemo: rec?.dayMemo ?? null,
      };
    });
    setAttendances(map);
    initializedForRef.current = id;
  }, [event, members, id]);

  const isLocked = event?.isLocked ?? false;

  const cycleStatus = useCallback(
    (memberId: string) => {
      if (isLocked || memberId !== selfId) return;
      setAttendances((prev) => {
        const cur = prev[memberId]?.status ?? "undecided";
        const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
        const updated = { ...prev[memberId], status: next };
        if (next === "maybe") setExpandedId(memberId);
        else setExpandedId(null);

        eventsApi
          .updateAttendance(org, id, {
            status: next,
            arriveTime: updated.arriveTime,
            leaveTime: updated.leaveTime,
            dayMemo: updated.dayMemo,
          })
          .catch(() => {
            setAttendances((p) => ({ ...p, [memberId]: prev[memberId] }));
          });

        return { ...prev, [memberId]: updated };
      });
    },
    [isLocked, selfId, org, id],
  );

  const saveMemo = useCallback(
    async (memberId: string, data: Partial<LocalAttendance>) => {
      if (memberId !== selfId) return;
      setSaving(true);
      const prev = attendances[memberId];
      const next = { ...prev, ...data };
      setAttendances((p) => ({ ...p, [memberId]: next }));
      try {
        await eventsApi.updateAttendance(org, id, {
          status: next.status,
          arriveTime: next.arriveTime,
          leaveTime: next.leaveTime,
          dayMemo: next.dayMemo,
        });
        setExpandedId(null);
      } catch {
        setAttendances((p) => ({ ...p, [memberId]: prev }));
      } finally {
        setSaving(false);
      }
    },
    [selfId, attendances, org, id],
  );

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

  const { partGroups, unassigned } = useMemo(() => {
    const sorted = [...parts].sort(comparePartOrder);
    return {
      partGroups: sorted
        .map((part) => ({ part, members: members.filter((m) => m.part?.id === part.id) }))
        .filter((g) => g.members.length > 0),
      unassigned: members.filter((m) => !m.part),
    };
  }, [parts, members]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="flex h-full flex-col">
        <header className="border-b border-gray-200 bg-white">
          <PageBleedRow className="flex items-center gap-4 py-4">
            <Link
              href={`/${org}/schedule`}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-gray-800">イベント詳細</h1>
          </PageBleedRow>
        </header>
        <div className="m-8 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{eventError?.message ?? "イベントが見つかりません"}</span>
        </div>
      </div>
    );
  }

  const selfAnswered = attendances[selfId]?.status !== "undecided";

  return (
    <div className="flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center justify-between py-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Link
              href={`/${org}/schedule`}
              className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-800">{event.title}</h1>
                {isLocked && (
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    <Lock size={10} /> 締切済み
                  </span>
                )}
                {!isLocked && selfAnswered && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                    回答済み
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-gray-400" />
                  {formatDatetime(event.startsAt)}〜{new Date(event.endsAt).getHours()}:
                  {String(new Date(event.endsAt).getMinutes()).padStart(2, "0")}
                </span>
                {event.location && (
                  <a
                    href={
                      event.locationUrl ??
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 flex items-center gap-1.5 hover:underline"
                  >
                    <MapPin size={13} className="text-brand-400 shrink-0" />
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

          {canManageSchedule(roles) && (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/${org}/schedule/${id}/edit`}
                prefetch={false}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              >
                <Pencil size={13} />
                編集
              </Link>
              <button
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setDeleteError(null);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 size={13} />
                削除
              </button>
            </div>
          )}
        </PageBleedRow>
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

      <PageMain className="space-y-4">
        {event.pageMemo && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
            <p className="mb-1 text-xs font-semibold text-amber-700">全体備考</p>
            <p className="text-sm leading-relaxed text-gray-700">{event.pageMemo}</p>
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
          <p className="text-center text-xs text-gray-400">
            自分の行（青色）をクリックして出欠を回答してください。○ → ✕ → △ → —
            の順に切り替わります。
          </p>
        )}
      </PageMain>
    </div>
  );
}
