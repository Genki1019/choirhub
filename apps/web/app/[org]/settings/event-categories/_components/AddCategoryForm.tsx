"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { settingsApi, type EventCategory } from "@/lib/settings-api";

const PRESET_COLORS = ["#10B981", "#F97316", "#8B5CF6", "#6B7280", "#3B82F6", "#EF4444", "#F59E0B", "#EC4899"];

interface AddCategoryFormProps {
  org: string;
  onCreated: (cat: EventCategory) => void;
}

export function AddCategoryForm({ org, onCreated }: AddCategoryFormProps) {
  const [newName,  setNewName]  = useState("");
  const [newColor, setNewColor] = useState("#6B7280");
  const [adding,   setAdding]   = useState(false);
  const [addError, setAddError] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) { setAddError("名前を入力してください"); return; }
    setAdding(true);
    setAddError("");
    try {
      const created = await settingsApi.createEventCategory(org, { name: newName.trim(), color: newColor });
      onCreated(created);
      setNewName("");
      setNewColor("#6B7280");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700">区分を追加</p>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-200"
          />
          <div className="flex gap-1 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-4 h-4 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <input
          value={newName}
          onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
          placeholder="区分名"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-1 text-sm font-medium text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          追加
        </button>
      </div>
      {addError && <p className="text-xs text-red-500">{addError}</p>}
    </div>
  );
}
