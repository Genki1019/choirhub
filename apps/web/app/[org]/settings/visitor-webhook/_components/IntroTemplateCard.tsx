"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { settingsApi, type VisitorIntroTemplate } from "@/lib/settings-api";
import { settingsKeys } from "@/lib/query-keys";

const DEFAULT_TEMPLATE: VisitorIntroTemplate = {
  subjectTemplate: "見学者のご紹介",
  bodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
  lineTemplate: "・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）",
};

const PREVIEW_SAMPLE = [
  { name: "見学 太郎", part: "テノール", origin: "○○大学グリークラブ" },
  { name: "見学 花子", part: "", origin: "" },
];

// バックエンドの renderTemplate と同じ規則:
// `[...]` は中の変数がすべて空なら区間ごと非表示、`[...]` の外の変数は空なら fallback（無ければ空文字）
function renderTemplate(
  template: string,
  vars: Record<string, string>,
  fallback: Record<string, string> = {},
): string {
  const afterOptionalSegments = template.replace(/\[([^[\]]*)\]/g, (whole, inner: string) => {
    const referenced = [...inner.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (referenced.length === 0) return inner;
    const hasValue = referenced.some((name) => vars[name]);
    if (!hasValue) return "";
    return inner.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? vars[key] : m));
  });

  return afterOptionalSegments.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    return vars[key] || fallback[key] || "";
  });
}

function buildPreview(template: VisitorIntroTemplate): { subject: string; body: string } {
  const lines = PREVIEW_SAMPLE.map((s) =>
    renderTemplate(template.lineTemplate, s, { part: "未定", origin: "未定" }),
  );
  return {
    subject: template.subjectTemplate,
    body: renderTemplate(template.bodyTemplate, { lines: lines.join("\n") }),
  };
}

const TEXTAREA_CLS =
  "focus:ring-brand-400 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:outline-none";

export function IntroTemplateCard({ org }: { org: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<VisitorIntroTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: settingsKeys.visitorIntroTemplate(org),
    queryFn: () => settingsApi.getVisitorIntroTemplate(org),
  });

  const effective = draft ?? data ?? DEFAULT_TEMPLATE;
  const preview = buildPreview(effective);

  const update = (patch: Partial<VisitorIntroTemplate>) => {
    setDraft({ ...effective, ...patch });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.updateVisitorIntroTemplate(org, effective);
      queryClient.setQueryData(settingsKeys.visitorIntroTemplate(org), updated);
      setDraft(null);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-5 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-gray-800">紹介文テンプレート</p>
        <p className="mt-1 text-xs text-gray-500">
          見学申込を承認した際の紹介メール・コピー用テキストの文面をカスタマイズできます。
          <br />
          使える変数: <code className="rounded bg-gray-100 px-1">{"{name}"}</code>（氏名）・
          <code className="rounded bg-gray-100 px-1">{"{part}"}</code>（希望パート）・
          <code className="rounded bg-gray-100 px-1">{"{origin}"}</code>（出身団体）・
          <code className="rounded bg-gray-100 px-1">{"{lines}"}</code>
          （本文内では見学者ごとの行がまとまって展開されます）
          <br />
          <code className="rounded bg-gray-100 px-1">{"[ ]"}</code>
          で囲むと、中の変数が空の見学者ではその区間ごと非表示になります（例:{" "}
          <code className="rounded bg-gray-100 px-1">{"[ / 出身団体: {origin}]"}</code>
          は出身団体が未入力なら丸ごと消えます）
        </p>
      </div>

      <div>
        <label htmlFor="intro-subject" className="mb-1 block text-xs font-medium text-gray-500">
          件名
        </label>
        <input
          id="intro-subject"
          value={effective.subjectTemplate}
          onChange={(e) => update({ subjectTemplate: e.target.value })}
          className={TEXTAREA_CLS}
        />
      </div>

      <div>
        <label htmlFor="intro-body" className="mb-1 block text-xs font-medium text-gray-500">
          本文（{"{lines}"} の位置に見学者の行がまとまって入ります）
        </label>
        <textarea
          id="intro-body"
          rows={3}
          value={effective.bodyTemplate}
          onChange={(e) => update({ bodyTemplate: e.target.value })}
          className={TEXTAREA_CLS}
        />
      </div>

      <div>
        <label htmlFor="intro-line" className="mb-1 block text-xs font-medium text-gray-500">
          見学者1名分の行
        </label>
        <input
          id="intro-line"
          value={effective.lineTemplate}
          onChange={(e) => update({ lineTemplate: e.target.value })}
          className={TEXTAREA_CLS}
        />
        <p className="mt-1 text-xs text-gray-400">
          デフォルトでは、希望パートが未入力の場合は「未定」、出身団体が未入力の場合はその項目ごと非表示になります
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">プレビュー（サンプル2名分）</p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs whitespace-pre-wrap text-gray-600">
          <p className="mb-1 font-semibold text-gray-700">{preview.subject}</p>
          {preview.body}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          保存
        </button>
        <button
          onClick={() => update(DEFAULT_TEMPLATE)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          <RotateCcw size={14} />
          デフォルトに戻す
        </button>
        {saved && <span className="text-xs text-teal-600">保存しました</span>}
      </div>
    </div>
  );
}
