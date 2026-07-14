"use client";

import { useState } from "react";
import type { AssignmentDetail } from "@/lib/concerts-api";

// テキスト入力＋送信ボタン（Enterまたはクリックで送信、空文字は送信しない）。
// AddBoxPopover の枠名入力と AddMemberPopover の客演者名入力で共用する
function InlineTextSubmit({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
}) {
  const trySubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") trySubmit();
        }}
        placeholder={placeholder}
        className="focus:border-brand-300 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none"
      />
      <button
        type="button"
        onClick={trySubmit}
        className="bg-brand-600 hover:bg-brand-700 shrink-0 rounded-lg px-3 py-1.5 text-xs text-white"
      >
        {submitLabel}
      </button>
    </div>
  );
}

export function AddBoxPopover({ onCreateBox }: { onCreateBox: (title: string) => void }) {
  const [title, setTitle] = useState("");

  return (
    <div className="absolute right-0 z-10 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs text-gray-500">新しい枠を作る（例: ソロ, 打楽器）</p>
      <InlineTextSubmit
        value={title}
        onChange={setTitle}
        onSubmit={onCreateBox}
        placeholder="枠の名前"
        submitLabel="作成"
        autoFocus
      />
    </div>
  );
}

export function AddMemberPopover({
  boxes,
  onConfirmedMembers,
  getExistingMemberIds,
  onPlaceMember,
  onPlaceGuest,
}: {
  boxes: { key: string; title: string }[];
  onConfirmedMembers: AssignmentDetail[];
  getExistingMemberIds: (boxKey: string) => Set<string>;
  onPlaceMember: (boxKey: string, member: AssignmentDetail) => void;
  onPlaceGuest: (boxKey: string, name: string) => void;
}) {
  const [mode, setMode] = useState<"member" | "guest">("member");
  const [targetBoxKey, setTargetBoxKey] = useState(boxes[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [guestName, setGuestName] = useState("");

  const existingIds = getExistingMemberIds(targetBoxKey);
  const filtered = onConfirmedMembers.filter(
    (m) => !existingIds.has(m.memberId) && m.nameJa.includes(query),
  );

  return (
    <div className="absolute right-0 z-10 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
      <select
        value={targetBoxKey}
        onChange={(e) => setTargetBoxKey(e.target.value)}
        className="focus:border-brand-300 mb-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none"
      >
        {boxes.map((b) => (
          <option key={b.key} value={b.key}>
            {b.title}
          </option>
        ))}
      </select>

      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode("member")}
          className={`flex-1 rounded-lg py-1 text-xs ${mode === "member" ? "bg-brand-50 text-brand-600 font-medium" : "text-gray-500"}`}
        >
          団員
        </button>
        <button
          type="button"
          onClick={() => setMode("guest")}
          className={`flex-1 rounded-lg py-1 text-xs ${mode === "guest" ? "bg-brand-50 text-brand-600 font-medium" : "text-gray-500"}`}
        >
          客演
        </button>
      </div>

      {mode === "member" ? (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="団員名で検索"
            className="focus:border-brand-300 mb-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none"
          />
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-1 py-2 text-xs text-gray-400">該当するメンバーがいません</p>
            )}
            {filtered.map((m) => (
              <button
                key={m.memberId}
                type="button"
                onClick={() => onPlaceMember(targetBoxKey, m)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-50"
              >
                {m.nameJa}
                {m.partName && <span className="ml-1 text-gray-400">{m.partName}</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <InlineTextSubmit
          value={guestName}
          onChange={setGuestName}
          onSubmit={(name) => onPlaceGuest(targetBoxKey, name)}
          placeholder="客演者の名前"
          submitLabel="追加"
          autoFocus
        />
      )}
    </div>
  );
}
