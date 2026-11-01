"use client";

import { useId, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { ErrorMessage } from "@/components/ErrorMessage";
import { fieldErrorProps } from "@/components/FieldError";
import { userErrorMessage } from "@/lib/api-client";

const PRESET_COLORS = [
  { value: "#10B981", name: "緑" },
  { value: "#F97316", name: "オレンジ" },
  { value: "#8B5CF6", name: "紫" },
  { value: "#6B7280", name: "グレー" },
  { value: "#3B82F6", name: "青" },
  { value: "#EF4444", name: "赤" },
  { value: "#F59E0B", name: "黄" },
  { value: "#EC4899", name: "ピンク" },
];

interface AddCategoryFormProps {
  org: string;
  onCreated: (cat: EventCategory) => void;
}

export function AddCategoryForm({ org, onCreated }: AddCategoryFormProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6B7280");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [nameMissing, setNameMissing] = useState(false);
  const errorId = useId();

  const handleAdd = async () => {
    if (adding) return;
    if (!newName.trim()) {
      setAddError("区分名を入力してください");
      setNameMissing(true);
      return;
    }
    setAdding(true);
    setAddError("");
    setNameMissing(false);
    try {
      const created = await settingsApi.createEventCategory(org, {
        name: newName.trim(),
        color: newColor,
      });
      onCreated(created);
      setNewName("");
      setNewColor("#6B7280");
    } catch (err) {
      setAddError(userErrorMessage(err, "区分の追加に失敗しました。もう一度お試しください。"));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold text-gray-700">区分を追加</p>
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 flex-col gap-1">
          <input
            type="color"
            aria-label="追加する区分の色"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-gray-200"
          />
          <div role="group" aria-label="よく使う色" className="grid grid-cols-4 gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                type="button"
                key={c.value}
                aria-label={c.name}
                aria-pressed={newColor.toLowerCase() === c.value.toLowerCase()}
                onClick={() => setNewColor(c.value)}
                className="h-6 w-6 rounded-full border-2 border-white shadow-sm aria-pressed:ring-2 aria-pressed:ring-gray-500"
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
        <input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setAddError("");
            setNameMissing(false);
          }}
          {...fieldErrorProps(errorId, addError, nameMissing)}
          aria-label="追加する区分名"
          placeholder="区分名"
          className="focus:ring-brand-400 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          aria-disabled={adding}
          className="bg-brand-600 hover:bg-brand-700 flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors aria-disabled:opacity-60"
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          追加
        </button>
      </div>
      <ErrorMessage id={errorId}>{addError}</ErrorMessage>
    </div>
  );
}
