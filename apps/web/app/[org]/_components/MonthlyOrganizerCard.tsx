"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { homeApi } from "@/lib/home-api";

interface MonthlyOrganizerCardProps {
  organizer: string | null;
  isTicketManager: boolean;
  org: string;
  onSaved: (value: string | null) => void;
}

export function MonthlyOrganizerCard({
  organizer, isTicketManager, org, onSaved,
}: MonthlyOrganizerCardProps) {
  const [editing,    setEditing]    = useState(false);
  const [inputValue, setInputValue] = useState(organizer ?? "");
  const [saving,     setSaving]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const partName = inputValue.trim() || null;
      await homeApi.setMonthlyOrganizer(org, partName);
      onSaved(partName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(organizer ?? "");
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col justify-between min-h-[100px]">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 font-medium">今月の幹事</p>
        {isTicketManager && !editing && (
          <button
            onClick={() => { setInputValue(organizer ?? ""); setEditing(true); }}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mt-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            placeholder="パート名を入力"
            maxLength={50}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button onClick={handleSave} disabled={saving} aria-label="保存" className="text-teal-600 hover:text-teal-800 disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button onClick={handleCancel} aria-label="キャンセル" className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <p className={`text-2xl font-bold mt-1 ${organizer ? "text-blue-500" : "text-gray-300"}`}>
            {organizer ?? "未設定"}
          </p>
          <p className="text-xs text-gray-400 mt-1">飲み会幹事パート</p>
        </>
      )}
    </div>
  );
}
