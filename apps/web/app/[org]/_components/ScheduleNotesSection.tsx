"use client";

import { Music, ClipboardList, Building2, FileText } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

export interface ScheduleNotesValues {
  rehearsalContent: string;
  timeSchedule: string;
  practiceVenue: string;
  otherNotes: string;
}

const FIELDS: {
  key: keyof ScheduleNotesValues;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
}[] = [
  {
    key: "rehearsalContent",
    label: "練習曲の内容（任意）",
    icon: <Music size={15} />,
    placeholder: "新曲『○○』の初見合わせ　など",
  },
  {
    key: "timeSchedule",
    label: "タイムスケジュール（任意）",
    icon: <ClipboardList size={15} />,
    placeholder: "18:00 集合 / 18:15 発声 / 19:00 パート練習",
  },
  {
    key: "practiceVenue",
    label: "練習会場（任意）",
    icon: <Building2 size={15} />,
    placeholder: "3階 大会議室　など",
  },
  {
    key: "otherNotes",
    label: "その他備考（任意）",
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
      {FIELDS.map(({ key, label, icon, placeholder }) => (
        <div key={key} className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <SectionLabel icon={icon} label={label} />
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
