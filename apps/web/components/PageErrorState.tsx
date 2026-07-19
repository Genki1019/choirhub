import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface PageErrorStateProps {
  title: string;
  backHref: string;
  message: string;
}

export function PageErrorState({ title, backHref, message }: PageErrorStateProps) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} backHref={backHref} />
      <div className="m-8 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
        <AlertCircle size={16} />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
