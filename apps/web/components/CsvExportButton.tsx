"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface CsvExportButtonProps {
  onDownload: () => Promise<void>;
  label?: string;
}

export function CsvExportButton({ onDownload, label = "CSV出力" }: CsvExportButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setDownloading(true);
    setError(null);
    try {
      await onDownload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSVの出力に失敗しました");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-500">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={downloading}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
      >
        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {label}
      </button>
    </div>
  );
}
