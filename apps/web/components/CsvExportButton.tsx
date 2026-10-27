"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { ErrorMessage } from "@/components/ErrorMessage";
import { userErrorMessage } from "@/lib/api-client";

interface CsvExportButtonProps {
  onDownload: () => Promise<void>;
  label?: string;
}

const DEFAULT_LABEL = "CSV出力";

export function CsvExportButton({ onDownload, label = DEFAULT_LABEL }: CsvExportButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      await onDownload();
    } catch (e) {
      const message = userErrorMessage(e, "CSVの出力に失敗しました。もう一度お試しください。");
      setError(label === DEFAULT_LABEL ? message : `${label}：${message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-disabled={downloading}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 aria-disabled:opacity-60"
      >
        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {label}
      </button>
      <ErrorMessage className="fixed inset-x-4 bottom-4 z-50 px-3 py-2 text-xs shadow-md sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-1 sm:w-max sm:max-w-sm sm:shadow-sm">
        {error}
      </ErrorMessage>
    </div>
  );
}
