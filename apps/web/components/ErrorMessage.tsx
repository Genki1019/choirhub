import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANT_CLASS = {
  inline: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600",
  section:
    "flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-500",
} as const;

interface ErrorMessageProps {
  children?: ReactNode;
  variant?: keyof typeof VARIANT_CLASS;
  className?: string;
}

export function ErrorMessage({ children, variant = "inline", className }: ErrorMessageProps) {
  if (!children) return null;

  return (
    <div role="alert" className={cn(VARIANT_CLASS[variant], className)}>
      {variant === "section" ? (
        <>
          <AlertCircle size={16} className="shrink-0" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </div>
  );
}
