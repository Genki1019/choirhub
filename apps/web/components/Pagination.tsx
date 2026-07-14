"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  meta: { total: number; page: number; perPage: number };
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(meta.total / meta.perPage);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
      <span className="text-xs text-gray-400">
        {(meta.page - 1) * meta.perPage + 1}–{Math.min(meta.page * meta.perPage, meta.total)} /{" "}
        {meta.total}件
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          aria-label="前のページ"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs text-gray-500">
          {meta.page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= totalPages}
          aria-label="次のページ"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
