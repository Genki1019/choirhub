"use client";

import { useState, useEffect } from "react";
import { Users, X, Loader2, Check } from "lucide-react";
import { scoresApi, type ScoreSummary } from "@/lib/scores-api";
import { membersApi, type MemberProfile } from "@/lib/members-api";
import { comparePartOrder } from "@/lib/voice-order";

interface PurchaseModalProps {
  orgSlug: string;
  score: ScoreSummary;
  onClose: () => void;
}

export function PurchaseModal({ orgSlug, score, onClose }: PurchaseModalProps) {
  const [allMembers, setAllMembers] = useState<MemberProfile[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    Promise.all([
      membersApi.list(orgSlug, { status: "active" }),
      scoresApi.getPurchases(orgSlug, score.id),
    ])
      .then(([members, purchases]) => {
        setAllMembers(members);
        setCheckedIds(new Set(purchases.map((p) => p.memberId)));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      })
      .finally(() => setLoading(false));
  }, [orgSlug, score.id]);

  const toggle = (memberId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await scoresApi.putPurchases(orgSlug, score.id, { memberIds: Array.from(checkedIds) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const partGroups = new Map<string, { partName: string; members: MemberProfile[] }>();
  allMembers.forEach((m) => {
    const key = m.part?.id ?? "__none__";
    if (!partGroups.has(key)) partGroups.set(key, { partName: m.part?.name ?? "パート未設定", members: [] });
    partGroups.get(key)!.members.push(m);
  });
  const sortedGroups = Array.from(partGroups.values()).sort((a, b) => {
    const pa = allMembers.find((m) => m.part?.name === a.partName)?.part;
    const pb = allMembers.find((m) => m.part?.name === b.partName)?.part;
    if (!pa) return 1;
    if (!pb) return -1;
    return comparePartOrder(pa, pb);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-brand-500 shrink-0" />
              <h2 className="font-semibold text-gray-800 text-sm truncate">購入者を記録</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{score.title}</p>
          </div>
          <button aria-label="閉じる" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">読み込み中...</span>
            </div>
          )}
          {!loading && error && (
            <p className="text-xs text-red-500 text-center py-4">{error}</p>
          )}
          {!loading && !error && sortedGroups.map(({ partName, members }) => (
            <div key={partName} className="mb-3">
              <p className="text-xs font-semibold text-gray-400 mb-1.5 px-1">{partName}</p>
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="w-4 h-4 rounded text-brand-600 accent-brand-600"
                  />
                  <span className="text-sm text-gray-700">{m.nameJa}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">{checkedIds.size}名が購入済み</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-gray-500 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
