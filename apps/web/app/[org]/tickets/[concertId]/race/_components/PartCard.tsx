import { useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { SCORING_CRITERIA } from "@/lib/scoring-criteria";
import {
  ticketsApi,
  type OrganizerPeriod,
  type RacePart,
  type RaceScoringConfig,
} from "@/lib/tickets-api";
import { RankBadge } from "./RankBadge";

function fmt(n: number, digits = 1) {
  return n.toFixed(digits);
}
function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function BreakdownChip({ label, points, max }: { label: string; points: number; max: number }) {
  if (points === 0) {
    return <span className="text-xs text-gray-300 line-through">{label}</span>;
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-brand-600 font-semibold">{points}</span>
      <span className="text-gray-300">/{max}</span>
    </span>
  );
}

function formatMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

const MONTH_SELECT_YEARS_BEFORE = 1;
const MONTH_SELECT_YEARS_AFTER = 3;

function MonthSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [year, setYear] = useState(() => value.split("-")[0] ?? "");
  const [month, setMonth] = useState(() => value.split("-")[1] ?? "");

  const commit = (nextYear: string, nextMonth: string) => {
    setYear(nextYear);
    setMonth(nextMonth);
    onChange(nextYear && nextMonth ? `${nextYear}-${nextMonth}` : "");
  };

  const currentYear = new Date().getFullYear();
  const years = new Set(
    Array.from(
      { length: MONTH_SELECT_YEARS_BEFORE + MONTH_SELECT_YEARS_AFTER + 1 },
      (_, i) => currentYear - MONTH_SELECT_YEARS_BEFORE + i,
    ),
  );
  if (year) years.add(Number(year));

  const selectClass =
    "rounded-lg border border-gray-300 bg-white px-1.5 py-1 text-xs focus:ring-2 focus:ring-teal-400 focus:outline-none";

  return (
    <span className="inline-flex items-center gap-0.5">
      <select
        aria-label={`${label}（年）`}
        value={year}
        onChange={(e) => commit(e.target.value, month)}
        className={selectClass}
      >
        <option value="">年</option>
        {[...years]
          .sort((a, b) => a - b)
          .map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
      </select>
      <span className="text-xs text-gray-400">年</span>
      <select
        aria-label={`${label}（月）`}
        value={month}
        onChange={(e) => commit(year, e.target.value)}
        className={selectClass}
      >
        <option value="">月</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={String(m).padStart(2, "0")}>
            {m}
          </option>
        ))}
      </select>
      <span className="text-xs text-gray-400">月</span>
    </span>
  );
}

interface OrganizerPeriodRowProps {
  partId: string;
  period: OrganizerPeriod | null;
  isTicketManager: boolean;
  org: string;
  concertId: string;
  onSaved: (partId: string, period: OrganizerPeriod | null) => void;
}

function OrganizerPeriodRow({
  partId,
  period,
  isTicketManager,
  org,
  concertId,
  onSaved,
}: OrganizerPeriodRowProps) {
  const [editing, setEditing] = useState(false);
  const [fromMonth, setFromMonth] = useState(period?.fromMonth ?? "");
  const [toMonth, setToMonth] = useState(period?.toMonth ?? "");
  const [saving, setSaving] = useState(false);

  if (!isTicketManager && !period) return null;

  if (!isTicketManager) {
    return (
      <p className="mt-2 text-xs text-gray-400">
        幹事期間: {formatMonth(period!.fromMonth)}〜{formatMonth(period!.toMonth)}
      </p>
    );
  }

  const handleSave = async () => {
    const nextPeriod = fromMonth && toMonth ? { fromMonth, toMonth } : null;
    setSaving(true);
    try {
      await ticketsApi.saveOrganizerPeriod(org, concertId, partId, nextPeriod);
      onSaved(partId, nextPeriod);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFromMonth(period?.fromMonth ?? "");
    setToMonth(period?.toMonth ?? "");
    setEditing(false);
  };

  const isRangeInvalid = !!fromMonth !== !!toMonth || (!!fromMonth && fromMonth > toMonth);

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
        <span>
          幹事期間:{" "}
          {period ? `${formatMonth(period.fromMonth)}〜${formatMonth(period.toMonth)}` : "未設定"}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-gray-300 transition-colors hover:text-gray-500"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <MonthSelect label="開始月" value={fromMonth} onChange={setFromMonth} />
      <span className="text-xs text-gray-400">〜</span>
      <MonthSelect label="終了月" value={toMonth} onChange={setToMonth} />
      <button
        onClick={handleSave}
        disabled={saving || isRangeInvalid}
        aria-label="保存"
        className="text-teal-600 hover:text-teal-800 disabled:opacity-40"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button
        onClick={handleCancel}
        aria-label="キャンセル"
        className="text-gray-400 hover:text-gray-600"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function PartCard({
  part,
  scoring,
  isTicketManager,
  org,
  concertId,
  onOrganizerPeriodSaved,
}: {
  part: RacePart;
  scoring: RaceScoringConfig;
  isTicketManager: boolean;
  org: string;
  concertId: string;
  onOrganizerPeriodSaved: (partId: string, period: OrganizerPeriod | null) => void;
}) {
  const bd = part.breakdown;
  const st = part.stats;
  const activeCriteria = SCORING_CRITERIA.filter((c) => scoring[c.key].enabled);
  const maxPoints = activeCriteria.reduce((s, c) => s + (scoring[c.key].points[0] ?? 0), 0);

  return (
    <div
      className={[
        "rounded-xl border px-5 py-4 transition-colors",
        part.rank === 1
          ? "border-amber-300 bg-amber-50"
          : part.rank === 2
            ? "border-gray-300 bg-gray-50"
            : part.rank === 3
              ? "border-orange-200 bg-orange-50"
              : "border-gray-100 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <RankBadge rank={part.rank} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-gray-800">{part.partName}</p>
            <p className="shrink-0 text-xl font-bold text-gray-800">
              {part.totalPoints}
              <span className="text-sm font-normal text-gray-400">/{maxPoints}pt</span>
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {activeCriteria.map((c) => (
              <BreakdownChip
                key={c.key}
                label={c.chipLabel}
                points={bd[c.breakdownKey]}
                max={scoring[c.key].points[0] ?? 0}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-400">
            <span>平均{fmt(st.avgSold)}枚</span>
            <span>
              {st.sold}/{st.allocated}枚 ({pct(st.allocated > 0 ? st.sold / st.allocated : 0)})
            </span>
            <span>情宣{st.totalOutreach}回</span>
            <span>0枚{Math.round(st.zeroSellerRatio * 100)}%</span>
          </div>
          {(st.speed5AchievedAt || st.speed10AchievedAt) && (
            <div className="mt-1 flex gap-3 text-xs text-gray-400">
              {st.speed5AchievedAt && (
                <span>5枚×3名: {new Date(st.speed5AchievedAt).toLocaleDateString("ja-JP")}</span>
              )}
              {st.speed10AchievedAt && (
                <span>10枚×3名: {new Date(st.speed10AchievedAt).toLocaleDateString("ja-JP")}</span>
              )}
            </div>
          )}
          <OrganizerPeriodRow
            partId={part.partId}
            period={part.organizerPeriod}
            isTicketManager={isTicketManager}
            org={org}
            concertId={concertId}
            onSaved={onOrganizerPeriodSaved}
          />
        </div>
      </div>
    </div>
  );
}
