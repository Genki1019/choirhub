import { X, Mail, Copy } from "lucide-react";

interface ApprovalDraftBannerProps {
  copied: boolean;
  onCompose: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export function ApprovalDraftBanner({
  copied,
  onCompose,
  onCopy,
  onClose,
}: ApprovalDraftBannerProps) {
  return (
    <div className="mb-4 space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-teal-700">承認しました。団員へ共有しますか？</p>
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="shrink-0 text-teal-500 transition-colors hover:text-teal-700"
        >
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-teal-600">
        画面を移動してもこの案内は消えません。団員へ共有し終えたら「閉じる」を押してください。
      </p>
      <div className="flex gap-2">
        <button
          onClick={onCompose}
          className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          <Mail size={14} />
          今すぐ紹介メールを送る
        </button>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          <Copy size={14} />
          {copied ? "コピーしました" : "テキストをコピーする"}
        </button>
      </div>
    </div>
  );
}
