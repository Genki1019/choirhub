import { PageHeader } from "@/components/PageHeader";
import { ErrorMessage } from "@/components/ErrorMessage";

interface PageErrorStateProps {
  title: string;
  backHref: string;
  message: string;
}

export function PageErrorState({ title, backHref, message }: PageErrorStateProps) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} backHref={backHref} />
      <ErrorMessage variant="section" className="m-8">
        {message}
      </ErrorMessage>
    </div>
  );
}
