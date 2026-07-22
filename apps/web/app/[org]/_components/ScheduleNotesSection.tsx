"use client";

import { Music, ClipboardList, Building2, FileText } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

export interface ScheduleNotesValues {
  rehearsalContent: string;
  timeSchedule: string;
  practiceVenue: string;
  otherNotes: string;
}

export const SCHEDULE_NOTES_FIELDS: {
  key: keyof ScheduleNotesValues;
  displayLabel: string;
  icon: React.ReactNode;
  placeholder: string;
}[] = [
  {
    key: "rehearsalContent",
    displayLabel: "練習曲の内容",
    icon: <Music size={15} />,
    placeholder: "新曲『○○』の初見合わせ　など",
  },
  {
    key: "timeSchedule",
    displayLabel: "タイムスケジュール",
    icon: <ClipboardList size={15} />,
    placeholder: "18:00 集合 / 18:15 発声 / 19:00 パート練習",
  },
  {
    key: "practiceVenue",
    displayLabel: "練習会場",
    icon: <Building2 size={15} />,
    placeholder: "3階 大会議室　など",
  },
  {
    key: "otherNotes",
    displayLabel: "その他備考",
    icon: <FileText size={15} />,
    placeholder: "個人ボイトレ希望者は事前連絡　など",
  },
];

export function ScheduleNotesSection({
  values,
  onChange,
}: {
  values: ScheduleNotesValues;
  onChange: (key: keyof ScheduleNotesValues, value: string) => void;
}) {
  return (
    <>
      {SCHEDULE_NOTES_FIELDS.map(({ key, displayLabel, icon, placeholder }) => (
        <div key={key} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <SectionLabel icon={icon} label={`${displayLabel}（任意）`} />
          <textarea
            value={values[key]}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="focus:ring-brand-400 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:ring-1 focus:outline-none"
          />
        </div>
      ))}
    </>
  );
}

export function ScheduleNotesDisplay({
  values,
}: {
  values: Partial<Record<keyof ScheduleNotesValues, string | null>>;
}) {
  const presentFields = SCHEDULE_NOTES_FIELDS.filter(({ key }) => values[key]);
  if (presentFields.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
      {presentFields.map(({ key, displayLabel }) => (
        <div key={key}>
          <p className="mb-1 text-xs font-semibold text-gray-500">{displayLabel}</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{values[key]}</p>
        </div>
      ))}
    </div>
  );
}
