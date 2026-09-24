import { Loader2 } from "lucide-react";

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
      <p role="alert" className="text-sm text-red-600">
        {loadErrorMessage}
      </p>
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
        {actionError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {actionError}
          </p>
        )}
        {content}
      </div>
    </section>
  );
}
