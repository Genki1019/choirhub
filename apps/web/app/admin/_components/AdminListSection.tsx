import { Loader2 } from "lucide-react";
import { ErrorMessage } from "@/components/ErrorMessage";

interface AdminListSectionProps {
  title: string;
  description?: string;
  isLoading: boolean;
  isError: boolean;
  loadErrorMessage: string;
  actionError: string | null;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}

export function AdminListSection({
  title,
  description,
  isLoading,
  isError,
  loadErrorMessage,
  actionError,
  isEmpty,
  emptyMessage,
  children,
}: AdminListSectionProps) {
  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  } else if (isError) {
    content = (
      <ErrorMessage variant="section" autoScroll={false}>
        {loadErrorMessage}
      </ErrorMessage>
    );
  } else if (isEmpty) {
    content = <p className="py-8 text-center text-sm text-gray-400">{emptyMessage}</p>;
  } else {
    content = <div className="space-y-3">{children}</div>;
  }

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-semibold text-gray-800">{title}</h2>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      <div className="mt-4">
        <ErrorMessage className="mb-4">{actionError}</ErrorMessage>
        {content}
      </div>
    </section>
  );
}
