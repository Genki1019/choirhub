"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Users, Loader2, Check } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { scoresApi, type ScoreDetail } from "@/lib/scores-api";
import { membersApi, type MemberProfile } from "@/lib/members-api";
import { comparePartOrder } from "@/lib/voice-order";
import { userErrorMessage } from "@/lib/api-client";

interface PurchaseModalProps {
  orgSlug: string;
  score: ScoreDetail;
  onClose: () => void;
}

export function PurchaseModal({ orgSlug, score, onClose }: PurchaseModalProps) {
  const [allMembers, setAllMembers] = useState<MemberProfile[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        setLoadError(
          userErrorMessage(err, "読み込みに失敗しました。閉じてからもう一度開いてください。"),
        );
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

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await scoresApi.putPurchases(orgSlug, score.id, { memberIds: Array.from(checkedIds) });
      onClose();
    } catch (err) {
      setSaveError(userErrorMessage(err, "保存に失敗しました。もう一度お試しください。"));
    } finally {
      setSaving(false);
    }
  };

  const partGroups = new Map<string, { partName: string; members: MemberProfile[] }>();
  allMembers.forEach((m) => {
    const key = m.part?.id ?? "__none__";
    if (!partGroups.has(key))
      partGroups.set(key, { partName: m.part?.name ?? "パート未設定", members: [] });
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
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Users size={15} className="text-brand-500 shrink-0" />
          購入者を記録
        </span>
      }
      description={score.title}
      size="sm"
      onClose={onClose}
      onSubmit={handleSave}
      busy={saving}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-gray-400">
            {checkedIds.size}名が購入済み
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving || loading || !!loadError}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            保存
          </button>
        </>
      }
    >
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      )}
      {!loading && <ErrorMessage variant="section">{loadError}</ErrorMessage>}
      {!loading &&
        !loadError &&
        sortedGroups.map(({ partName, members }) => (
          <div key={partName}>
            <p className="mb-1.5 px-1 text-xs font-semibold text-gray-400">{partName}</p>
            {members.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(m.id)}
                  onChange={() => toggle(m.id)}
                  className="text-brand-600 accent-brand-600 h-4 w-4 rounded"
                />
                <span className="text-sm text-gray-700">{m.nameJa}</span>
              </label>
            ))}
          </div>
        ))}
      <ErrorMessage>{saveError}</ErrorMessage>
    </Modal>
  );
}
