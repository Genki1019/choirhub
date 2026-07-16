"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, AlertCircle, FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/lib/events-api";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { canManageSchedule } from "@/lib/roles";
import { settingsApi } from "@/lib/settings-api";
import { toJstIso, isoToJstParts } from "@/lib/date";
import { eventKeys, memberKeys } from "@/lib/query-keys";
import { NotFoundPage } from "@/components/NotFoundPage";
import { LocationSearch } from "@/components/LocationSearch";
import { SectionLabel } from "../../../_components/SectionLabel";
import { TargetAudienceSection } from "../../../_components/TargetAudienceSection";
import { DeadlineSection } from "../../../_components/DeadlineSection";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function EditSchedulePage() {
  const { org, id } = useParams<{ org: string; id: string }>();
  const router = useRouter();

  const { roles } = useMember();
  const canEdit = canManageSchedule(roles);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetPartIds, setTargetPartIds] = useState<string[]>([]);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [pageMemo, setPageMemo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    data: event,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: eventKeys.detail(org, id),
    queryFn: () => eventsApi.get(org, id),
    enabled: canEdit,
  });
  const {
    data: parts = [],
    isLoading: partsLoading,
    error: partsError,
  } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    enabled: canEdit,
  });
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery({
    queryKey: eventKeys.categories(org),
    queryFn: () => settingsApi.listEventCategories(org),
    enabled: canEdit,
  });

  const loading = canEdit && (eventLoading || partsLoading || categoriesLoading);
  const initError = eventError?.message ?? partsError?.message ?? categoriesError?.message ?? null;

  // イベントデータが揃ったときだけフォームを初期化する（再フェッチで上書きしない）
  const [initializedId, setInitializedId] = useState<string | null>(null);
  if (event && initializedId !== id) {
    setInitializedId(id);

    setTitle(event.title);
    setCategoryId(event.category.id);

    const s = isoToJstParts(event.startsAt);
    setStartDate(s.date);
    setStartTime(s.time);

    const e = isoToJstParts(event.endsAt);
    setEndDate(e.date);
    setEndTime(e.time);

    setLocation(event.location ?? "");
    setLocationUrl(event.locationUrl ?? "");
    setTargetRoles(event.targetRoles ?? []);
    setTargetPartIds(event.targetPartIds ?? []);

    if (event.deadline) {
      setHasDeadline(true);
      const d = isoToJstParts(event.deadline);
      setDeadlineDate(d.date);
      setDeadlineTime(d.time);
    }

    setPageMemo(event.pageMemo ?? "");
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex h-full flex-col">
        <header className="border-b border-gray-200 bg-white">
          <PageBleedRow className="flex items-center gap-4 py-4">
            <Link href={`/${org}/schedule/${id}`} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-gray-800">イベントを編集</h1>
          </PageBleedRow>
        </header>
        <div className="m-8 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{initError}</span>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex h-full flex-col">
        <NotFoundPage message="このページにアクセスする権限がありません" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    if (!startDate) {
      setError("開始日を選択してください。");
      return;
    }
    if (!endDate) {
      setError("終了日を選択してください。");
      return;
    }
    if (hasDeadline && !deadlineDate) {
      setError("締切日を選択してください。");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await eventsApi.update(org, id, {
        title: title.trim(),
        categoryId,
        startsAt: toJstIso(startDate, startTime),
        endsAt: toJstIso(endDate, endTime),
        location: location || null,
        locationUrl: locationUrl || null,
        targetRoles: targetRoles.length > 0 ? targetRoles : null,
        targetPartIds: targetPartIds.length > 0 ? targetPartIds : null,
        deadline: hasDeadline && deadlineDate ? toJstIso(deadlineDate, deadlineTime) : null,
        pageMemo: pageMemo || null,
      });
      router.push(`/${org}/schedule/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center gap-4 py-4">
          <Link
            href={`/${org}/schedule/${id}`}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">イベントを編集</h1>
        </PageBleedRow>
      </header>

      <PageMain>
        <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* タイトル + 種別 */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              placeholder="タイトルを追加 *"
              className="focus:border-brand-400 w-full border-b border-gray-200 pb-2 text-base font-medium text-gray-800 placeholder-gray-300 transition-colors focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    categoryId === cat.id
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
                  ].join(" ")}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 日時 */}
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
            <SectionLabel icon={<Calendar size={15} />} label="日時" />
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-xs text-gray-400">開始</span>
                <input
                  type="date"
                  aria-label="開始日"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="focus:ring-brand-400 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
                <input
                  type="time"
                  aria-label="開始時刻"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="focus:ring-brand-400 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-xs text-gray-400">終了</span>
                <input
                  type="date"
                  aria-label="終了日"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="focus:ring-brand-400 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
                <input
                  type="time"
                  aria-label="終了時刻"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="focus:ring-brand-400 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 場所 */}
          <div className="relative z-10 rounded-xl border border-gray-200 bg-white px-5 py-4">
            <SectionLabel icon={<MapPin size={15} />} label="場所" />
            <LocationSearch
              value={location}
              mapUrl={locationUrl}
              onChangeName={(name) => {
                setLocation(name);
                setLocationUrl("");
              }}
              onSelectPlace={(name, url) => {
                setLocation(name);
                setLocationUrl(url);
              }}
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
            onToggle={() => setHasDeadline((v) => !v)}
            onDateChange={setDeadlineDate}
            onTimeChange={setDeadlineTime}
          />

          {/* 全体備考 */}
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
            <SectionLabel icon={<FileText size={15} />} label="全体備考（任意）" />
            <textarea
              value={pageMemo}
              onChange={(e) => setPageMemo(e.target.value)}
              placeholder="メンバーへの連絡事項など"
              rows={3}
              className="focus:ring-brand-400 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:ring-1 focus:outline-none"
            />
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pb-8">
            <Link
              href={`/${org}/schedule/${id}`}
              className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存する
            </button>
          </div>
        </form>
      </PageMain>
    </div>
  );
}
