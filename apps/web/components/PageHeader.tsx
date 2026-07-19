import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageBleedRow } from "@/components/PageBleedRow";

export interface PageHeaderProps {
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  badge,
  subtitle,
  backHref,
  actions,
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`shrink-0 border-b border-gray-200 bg-white ${className}`}>
      <PageBleedRow className="flex items-center gap-3 py-4">
        {backHref && (
          <Link
            href={backHref}
            className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {badge ? (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
              {badge}
            </div>
          ) : (
            <h1 className="truncate text-lg font-semibold text-gray-800">{title}</h1>
          )}
          {subtitle && <div className="mt-0.5 text-xs text-gray-400">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </PageBleedRow>
      {children}
    </header>
  );
}
