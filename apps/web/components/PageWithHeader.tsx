import { Loader2 } from "lucide-react";
import { PageHeader, type PageHeaderProps } from "@/components/PageHeader";
import { PageMain } from "@/components/PageMain";

export interface PageWithHeaderProps extends Pick<
  PageHeaderProps,
  "title" | "badge" | "subtitle" | "backHref" | "actions"
> {
  loading?: boolean;
  mainClassName?: string;
  children: React.ReactNode;
}

export function PageWithHeader({
  title,
  badge,
  subtitle,
  backHref,
  actions,
  loading = false,
  mainClassName,
  children,
}: PageWithHeaderProps) {
  return (
    <div className="flex flex-col">
      <PageHeader
        title={title}
        badge={badge}
        subtitle={subtitle}
        backHref={backHref}
        actions={actions}
      />
      <PageMain>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : mainClassName ? (
          <div className={mainClassName}>{children}</div>
        ) : (
          children
        )}
      </PageMain>
    </div>
  );
}
