"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, Lock, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { comparePartOrder } from "@/lib/voice-order";
import { canManageSchedule, canManageAttachments } from "@/lib/roles";
import { eventKeys, memberKeys } from "@/lib/query-keys";
import { AttendanceTable, type LocalAttendance } from "./_components/AttendanceTable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { userErrorMessage } from "@/lib/api-client";
import { PageWithHeader } from "@/components/PageWithHeader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ScheduleNotesDisplay } from "../../_components/ScheduleNotesSection";
import { PageMain } from "@/components/PageMain";
import { PageHeader } from "@/components/PageHeader";
import { PageErrorState } from "@/components/PageErrorState";
import { FileAttachmentSection } from "@/components/FileAttachmentSection";
import { jstParts } from "@/lib/date";

const STATUS_CYCLE = ["attending", "absent", "maybe", "undecided"] as const;
const AUDIO_EXTENSIONS = [".mp3", ".wav"];
const AUDIO_ACCEPT = AUDIO_EXTENSIONS.join(",");

function isAudioFile(fileName: string) {
  const lower = fileName.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatDatetime(iso: string) {
  const { month, day, weekday, hours, minutes } = jstParts(iso);
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  return `${month}/${day}（${DOW[weekday]}）${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  const { hours, minutes } = jstParts(iso);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
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
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

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
  const confirmedAttendances = useRef<Record<string, LocalAttendance>>({});
  const lastRequestId = useRef(0);
  const lastConfirmedRequestId = useRef(0);
  const lastFailedRequestId = useRef(0);
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
    confirmedAttendances.current = map;
    initializedForRef.current = id;
  }, [event, members, id]);

  const isLocked = event?.isLocked ?? false;
  const isRehearsal = event?.category.slug === "rehearsal" || event?.category.name === "練習";

  const submitAttendance = useCallback(
    async (memberId: string, next: LocalAttendance) => {
      const requestId = ++lastRequestId.current;
      setAttendances((p) => ({ ...p, [memberId]: next }));
      setAttendanceError(null);
      try {
        await eventsApi.updateAttendance(org, id, {
          status: next.status,
          arriveTime: next.arriveTime,
          leaveTime: next.leaveTime,
          dayMemo: next.dayMemo,
        });
        if (requestId > lastConfirmedRequestId.current) {
          lastConfirmedRequestId.current = requestId;
          confirmedAttendances.current = { ...confirmedAttendances.current, [memberId]: next };
          if (lastFailedRequestId.current === lastRequestId.current) {
            setAttendances((p) => ({ ...p, [memberId]: next }));
          }
        }
        return requestId === lastRequestId.current;
      } catch (err) {
        if (requestId === lastRequestId.current) {
          lastFailedRequestId.current = requestId;
          setAttendances((p) => ({ ...p, [memberId]: confirmedAttendances.current[memberId] }));
          setAttendanceError(
            userErrorMessage(err, "出欠の回答を保存できませんでした。もう一度お試しください。"),
          );
        }
        return false;
      }
    },
    [org, id],
  );

  const cycleStatus = useCallback(
    (memberId: string) => {
      if (isLocked || memberId !== selfId) return;
      const prev = attendances[memberId];
      const cur = prev?.status ?? "undecided";
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      setExpandedId(next === "maybe" ? memberId : null);
      void submitAttendance(memberId, { ...prev, status: next });
    },
    [isLocked, selfId, attendances, submitAttendance],
  );

  const saveMemo = useCallback(
    async (memberId: string, data: Partial<LocalAttendance>) => {
      if (memberId !== selfId) return;
      setSaving(true);
      if (await submitAttendance(memberId, { ...attendances[memberId], ...data })) {
        setExpandedId(null);
      }
      setSaving(false);
    },
    [selfId, attendances, submitAttendance],
  );

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await eventsApi.delete(org, id);
      router.push(`/${org}/schedule`);
    } catch (err: unknown) {
      setDeleteError(userErrorMessage(err, "削除に失敗しました。もう一度お試しください。"));
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
      <PageWithHeader title="イベント詳細" backHref={`/${org}/schedule`} loading>
        {null}
      </PageWithHeader>
    );
  }

  if (eventError || !event) {
    return (
      <PageErrorState
        title="イベント詳細"
        backHref={`/${org}/schedule`}
        message={
          eventError
            ? userErrorMessage(
                eventError,
                "予定の読み込みに失敗しました。ページを再読み込みしてください。",
              )
            : "イベントが見つかりません"
        }
      />
    );
  }

  const selfAnswered = attendances[selfId]?.status !== "undecided";

  const statusBadge = isLocked ? (
    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      <Lock size={10} /> 締切済み
    </span>
  ) : selfAnswered ? (
    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
      回答済み
    </span>
  ) : undefined;

  const eventMeta = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
      <span className="flex items-center gap-1.5">
        <Clock size={13} className="text-gray-400" />
        {formatDatetime(event.startsAt)}〜{formatTime(event.endsAt)}
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
  );

  const manageActions = canManageSchedule(roles) ? (
    <>
      <Link
        href={`/${org}/schedule/${id}/edit`}
        prefetch={false}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        <Pencil size={13} />
        編集
      </Link>
      <button
        type="button"
        onClick={() => {
          setShowDeleteConfirm(true);
          setDeleteError(null);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={13} />
        削除
      </button>
    </>
  ) : undefined;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={event.title}
        backHref={`/${org}/schedule`}
        badge={statusBadge}
        subtitle={eventMeta}
        actions={manageActions}
      />

      {showDeleteConfirm && (
        <ConfirmDialog
          title="イベントを削除しますか？"
          description={`「${event.title}」と出欠の回答がすべて削除されます。この操作は取り消せません。`}
          confirmLabel="削除する"
          busy={deleting}
          error={deleteError}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      <PageMain className="space-y-4">
        <ScheduleNotesDisplay
          values={{
            rehearsalContent: event.rehearsalContent,
            timeSchedule: event.timeSchedule,
            practiceVenue: event.practiceVenue,
            otherNotes: event.otherNotes,
          }}
        />

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <FileAttachmentSection
            title="添付ファイル"
            queryKey={eventKeys.files(org, id)}
            canManage={canManageAttachments(roles)}
            listFiles={async () =>
              (await eventsApi.listFiles(org, id)).filter((f) => !isAudioFile(f.fileName))
            }
            uploadFile={(file, label) => eventsApi.uploadFile(org, id, file, label)}
            deleteFile={(fileId) => eventsApi.deleteFile(org, id, fileId)}
          />
        </div>

        {isRehearsal && (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
            <FileAttachmentSection
              title="練習録音"
              queryKey={[...eventKeys.files(org, id), "recordings"]}
              canManage={canManageAttachments(roles)}
              listFiles={async () =>
                (await eventsApi.listFiles(org, id)).filter((f) => isAudioFile(f.fileName))
              }
              uploadFile={(file, label) => eventsApi.uploadFile(org, id, file, label)}
              deleteFile={(fileId) => eventsApi.deleteFile(org, id, fileId)}
              accept={AUDIO_ACCEPT}
              labelInput="text"
              renderFile={(f) => (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-gray-700">{f.fileName}</p>
                  {f.downloadUrl && (
                    <audio controls src={f.downloadUrl} className="mt-1 h-8 w-full max-w-xs" />
                  )}
                </div>
              )}
            />
          </div>
        )}

        <ErrorMessage>{attendanceError}</ErrorMessage>

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
