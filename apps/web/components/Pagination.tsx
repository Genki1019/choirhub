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
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
      <span className="text-xs text-gray-400">
        {(meta.page - 1) * meta.perPage + 1}–{Math.min(meta.page * meta.perPage, meta.total)} / {meta.total}件
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1} aria-label="前のページ" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-gray-500 px-2">{meta.page} / {totalPages}</span>
        <button onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= totalPages} aria-label="次のページ" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
