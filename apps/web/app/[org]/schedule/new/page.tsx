"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, AlertCircle, FileText, Loader2 } from "lucide-react";
import { eventsApi, type EventCategory } from "@/lib/events-api";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { NotFoundPage } from "@/components/NotFoundPage";
import { LocationSearch } from "@/components/LocationSearch";
import { TargetAudienceSection } from "../../_components/TargetAudienceSection";
import { DeadlineSection } from "../../_components/DeadlineSection";
import { PageMain } from "@/components/PageMain";

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-3">
      {icon}
      {label}
    </div>
  );
}

function toJstIso(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function NewSchedulePage() {
  const { org } = useParams<{ org: string }>();
  const router  = useRouter();

  const [canCreate,    setCanCreate]    = useState<boolean | null>(null);
  const [parts,        setParts]        = useState<PartSummary[]>([]);
  const [categories,   setCategories]   = useState<EventCategory[]>([]);
  const [initError,    setInitError]    = useState<string | null>(null);

  const [title,         setTitle]         = useState("");
  const [categoryId,    setCategoryId]    = useState("");
  const [startDate,     setStartDate]     = useState(getTodayStr);
  const [startTime,     setStartTime]     = useState("18:00");
  const [endDate,       setEndDate]       = useState(getTodayStr);
  const [endTime,       setEndTime]       = useState("22:00");
  const [location,      setLocation]      = useState("");
  const [locationUrl,   setLocationUrl]   = useState("");
  const [targetRoles,   setTargetRoles]   = useState<string[]>([]);
  const [targetPartIds, setTargetPartIds] = useState<string[]>([]);
  const [hasDeadline,   setHasDeadline]   = useState(false);
  const [deadlineDate,  setDeadlineDate]  = useState("");
  const [deadlineTime,  setDeadlineTime]  = useState("23:59");
  const [pageMemo,      setPageMemo]      = useState("");
  const [error,         setError]         = useState("");
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([membersApi.me(org), membersApi.parts(org), settingsApi.listEventCategories(org)])
      .then(([me, partList, catList]) => {
        if (cancelled) return;
        setCanCreate(me.roles.includes("admin") || me.roles.includes("tech"));
        setParts(partList);
        setCategories(catList);
        if (catList.length > 0) setCategoryId(catList[0].id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setInitError(err instanceof Error ? err.message : "権限の確認に失敗しました");
      });
    return () => { cancelled = true; };
  }, [org, router]);

  if (canCreate === null && !initError) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 sm:px-8 py-4 bg-white border-b border-gray-200">
          <Link href={`/${org}/schedule`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">イベントを追加</h1>
        </header>
        <div className="m-8 flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{initError}</span>
        </div>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="flex flex-col h-full">
        <NotFoundPage message="このページにアクセスする権限がありません" />
      </div>
    );
  }

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (!endDate || endDate === startDate) setEndDate(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim())                { setError("タイトルを入力してください。"); return; }
    if (!startDate)                   { setError("開始日を選択してください。"); return; }
    if (!endDate)                     { setError("終了日を選択してください。"); return; }
    if (hasDeadline && !deadlineDate) { setError("締切日を選択してください。"); return; }

    setSaving(true);
    setError("");

    try {
      await eventsApi.create(org, {
        title:         title.trim(),
        categoryId,
        startsAt:      toJstIso(startDate, startTime),
        endsAt:        toJstIso(endDate,   endTime),
        location:      location     || null,
        locationUrl:   locationUrl  || null,
        targetRoles:   targetRoles.length   > 0 ? targetRoles   : null,
        targetPartIds: targetPartIds.length  > 0 ? targetPartIds : null,
        deadline:      hasDeadline && deadlineDate ? toJstIso(deadlineDate, deadlineTime) : null,
        pageMemo:      pageMemo     || null,
      });
      router.push(`/${org}/schedule`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "作成に失敗しました。");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      <header className="flex items-center gap-3 px-4 sm:px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <Link href={`/${org}/schedule`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">イベントを追加</h1>
      </header>

      <PageMain>
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* タイトル + 種別 */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-4">
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(""); }}
              placeholder="タイトルを追加 *"
              className="w-full text-base font-medium text-gray-800 placeholder-gray-300 border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-400 transition-colors"
              autoFocus
            />
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map(cat => (
                <ToggleChip
                  key={cat.id}
                  label={cat.name}
                  active={categoryId === cat.id}
                  onClick={() => setCategoryId(cat.id)}
                />
              ))}
            </div>
          </div>

          {/* 日時 */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <SectionLabel icon={<Calendar size={15} />} label="日時" />
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-8 shrink-0">開始</span>
                <input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-8 shrink-0">終了</span>
                <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
          </div>

          {/* 場所 */}
          <div className="relative z-10 bg-white rounded-xl border border-gray-200 px-5 py-4">
            <SectionLabel icon={<MapPin size={15} />} label="場所" />
            <LocationSearch
              value={location}
              mapUrl={locationUrl}
              onChangeName={(name) => { setLocation(name); setLocationUrl(""); }}
              onSelectPlace={(name, url) => { setLocation(name); setLocationUrl(url); }}
            />
          </div>

          {/* 招待対象 */}
          <TargetAudienceSection
            parts={parts}
            targetRoles={targetRoles}
            targetPartIds={targetPartIds}
            onRolesChange={setTargetRoles}
            onPartIdsChange={setTargetPartIds}
          />

          {/* 出欠締切 */}
          <DeadlineSection
            hasDeadline={hasDeadline}
            deadlineDate={deadlineDate}
            deadlineTime={deadlineTime}
            startDate={startDate}
            onToggle={() => setHasDeadline(v => !v)}
            onDateChange={setDeadlineDate}
            onTimeChange={setDeadlineTime}
          />

          {/* 全体備考 */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <SectionLabel icon={<FileText size={15} />} label="全体備考（任意）" />
            <textarea
              value={pageMemo}
              onChange={e => setPageMemo(e.target.value)}
              placeholder="メンバーへの連絡事項など"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 resize-none"
            />
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pb-8">
            <Link
              href={`/${org}/schedule`}
              className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              作成する
            </button>
          </div>
        </form>
      </PageMain>
    </div>
  );
}
