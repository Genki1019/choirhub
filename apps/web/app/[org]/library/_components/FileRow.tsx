import { FileText } from "lucide-react";
import type { CrossFileItem } from "@/lib/files-api";

interface FileRowProps {
  file: CrossFileItem;
}

/**
 * 横断一覧の1行。削除はここでは行わず、「詳細へ」で対象の詳細画面（既存のFileManageModal/
 * FileAttachmentSectionによる管理UI）に遷移してもらう設計（一覧側にresourceIdを持たせないため）。
 */
export function FileRow({ file }: FileRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
      <FileText size={15} className="text-brand-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <a
          href={file.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-700 hover:underline"
        >
          {file.title}
        </a>
        <p className="truncate text-xs text-gray-400">{file.subtitle}</p>
      </div>
      <a
        href={file.resourceLink}
        className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-300"
      >
        詳細へ
      </a>
    </div>
  );
}
