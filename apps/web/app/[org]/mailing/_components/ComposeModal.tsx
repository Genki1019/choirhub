"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Send, BookMarked, Trash2 } from "lucide-react";
import { mailingApi, type RecipientType, type MailTemplate } from "@/lib/mailing-api";
import { membersApi, type MemberProfile, type PartSummary } from "@/lib/members-api";
import { ROLES } from "@/lib/roles";

const RECIPIENT_TABS: { key: RecipientType; label: string }[] = [
  { key: "all", label: "全員" },
  { key: "part", label: "パート" },
  { key: "role", label: "ロール" },
  { key: "custom", label: "個別" },
];

interface SaveTemplateModalProps {
  orgSlug: string;
  subject: string;
  body: string;
  onClose: () => void;
  onSaved: (t: MailTemplate) => void;
}

function SaveTemplateModal({ orgSlug, subject, body, onClose, onSaved }: SaveTemplateModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("テンプレート名を入力してください");
      return;
    }
    if (!subject.trim()) {
      setError("件名が空です");
      return;
    }
    if (!body.trim()) {
      setError("本文が空です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const template = await mailingApi.templates.save(orgSlug, {
        name: name.trim(),
        subject,
        body,
      });
      onSaved(template);
      onClose();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">テンプレートとして保存</h3>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            テンプレート名 <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 練習案内テンプレート"
            className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            autoFocus
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}保存
          </button>
        </div>
      </div>
    </div>
  );
}

interface TemplatePanelProps {
  orgSlug: string;
  onApply: (t: MailTemplate) => void;
  onClose: () => void;
}

function TemplatePanel({ orgSlug, onApply, onClose }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    mailingApi.templates
      .list(orgSlug)
      .then((templates) => setTemplates(templates))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgSlug]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setConfirmDeleteId(null);
    try {
      await mailingApi.templates.delete(orgSlug, id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <span className="text-xs font-medium text-gray-600">テンプレート</span>
        <button
          aria-label="テンプレートパネルを閉じる"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-44 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-gray-400">
            <Loader2 size={13} className="animate-spin" />
            <span className="text-xs">読み込み中...</span>
          </div>
        )}
        {!loading && templates.length === 0 && (
          <p className="px-4 py-3 text-xs text-gray-400">保存済みテンプレートがありません</p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="border-b border-gray-100 last:border-0">
            {confirmDeleteId === t.id ? (
              <div className="flex items-center justify-between bg-red-50 px-4 py-2.5">
                <p className="text-xs text-red-600">削除しますか？</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                    className="rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleting === t.id ? (
                      <Loader2 size={11} className="inline animate-spin" />
                    ) : (
                      "削除"
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="group flex items-center justify-between px-4 py-2.5 hover:bg-white">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    onApply(t);
                    onClose();
                  }}
                >
                  <p className="truncate text-sm font-medium text-gray-700">{t.name}</p>
                  <p className="truncate text-xs text-gray-400">{t.subject}</p>
                </button>
                <button
                  onClick={() => setConfirmDeleteId(t.id)}
                  disabled={deleting === t.id}
                  className="ml-2 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 disabled:opacity-50"
                  aria-label="テンプレートを削除"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ComposeModalProps {
  orgSlug: string;
  parts: PartSummary[];
  onClose: () => void;
  onSent: () => void;
  initialSubject?: string;
  initialBody?: string;
  initialRecipientType?: RecipientType;
}

export function ComposeModal({
  orgSlug,
  parts,
  onClose,
  onSent,
  initialSubject = "",
  initialBody = "",
  initialRecipientType = "all",
}: ComposeModalProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [recipientType, setRecipientType] = useState<RecipientType>(initialRecipientType);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleRecipientTypeChange = (type: RecipientType) => {
    setRecipientType(type);
    setError(null);
    if (type === "custom" && members.length === 0) {
      setLoadingMembers(true);
      membersApi
        .list(orgSlug, { status: "active" })
        .then(setMembers)
        .catch(() => setError("メンバーの取得に失敗しました"))
        .finally(() => setLoadingMembers(false));
    }
  };

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const buildFilter = () => {
    if (recipientType === "part") return { partIds: Array.from(selectedPartIds) };
    if (recipientType === "role") return { roles: Array.from(selectedRoles) };
    if (recipientType === "custom") return { memberIds: Array.from(selectedMemberIds) };
    return null;
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      setError("件名を入力してください");
      return;
    }
    if (!body.trim()) {
      setError("本文を入力してください");
      return;
    }
    if (recipientType === "part" && selectedPartIds.size === 0) {
      setError("パートを選択してください");
      return;
    }
    if (recipientType === "role" && selectedRoles.size === 0) {
      setError("ロールを選択してください");
      return;
    }
    if (recipientType === "custom" && selectedMemberIds.size === 0) {
      setError("送信先を選択してください");
      return;
    }

    setSending(true);
    setError(null);
    try {
      await mailingApi.send(orgSlug, {
        subject: subject.trim(),
        body: body.trim(),
        recipientType,
        recipientFilter: buildFilter(),
      });
      onSent();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-800">新規メール</h2>
            <button
              aria-label="閉じる"
              onClick={onClose}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                件名 <span className="text-red-500">*</span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="例: 6月練習のご案内"
                className="focus:ring-brand-400 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                本文 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="メール本文を入力..."
                rows={10}
                className="focus:ring-brand-400 w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">送信先</label>
              <div className="flex overflow-hidden rounded-lg border border-gray-200">
                {RECIPIENT_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleRecipientTypeChange(key)}
                    className={`flex-1 border-r border-gray-200 py-2 text-xs font-medium transition-colors last:border-0 ${
                      recipientType === key
                        ? "bg-brand-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {recipientType === "part" && (
              <div className="space-y-1.5">
                {parts.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPartIds.has(p.id)}
                      onChange={() => setSelectedPartIds((s) => toggle(s, p.id))}
                      className="accent-brand-600 h-4 w-4 rounded"
                    />
                    <span className="text-sm text-gray-700">{p.name}</span>
                  </label>
                ))}
              </div>
            )}

            {recipientType === "role" && (
              <div className="space-y-1.5">
                {ROLES.filter((r) => r.key !== "visitor").map((r) => (
                  <label
                    key={r.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.has(r.key)}
                      onChange={() => setSelectedRoles((s) => toggle(s, r.key))}
                      className="accent-brand-600 h-4 w-4 rounded"
                    />
                    <span className="text-sm text-gray-700">{r.defaultName}</span>
                    <span className="text-xs text-gray-400">{r.description}</span>
                  </label>
                ))}
              </div>
            )}

            {recipientType === "custom" &&
              (loadingMembers ? (
                <div className="flex items-center gap-2 py-2 text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-sm">読み込み中...</span>
                </div>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.has(m.id)}
                        onChange={() => setSelectedMemberIds((s) => toggle(s, m.id))}
                        className="accent-brand-600 h-4 w-4 rounded"
                      />
                      <span className="text-sm text-gray-700">{m.nameJa}</span>
                      {m.part && <span className="text-xs text-gray-400">{m.part.name}</span>}
                    </label>
                  ))}
                </div>
              ))}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          {showTemplatePanel && (
            <TemplatePanel
              orgSlug={orgSlug}
              onApply={(t) => {
                setSubject(t.subject);
                setBody(t.body);
              }}
              onClose={() => setShowTemplatePanel(false)}
            />
          )}

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTemplatePanel((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${showTemplatePanel ? "border-brand-300 text-brand-600 bg-brand-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
              >
                <BookMarked size={13} />
                テンプレート
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
              >
                保存
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                送信する
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <SaveTemplateModal
          orgSlug={orgSlug}
          subject={subject}
          body={body}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}
