import { Loader2 } from "lucide-react";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

interface SettingsPageShellProps {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}

export function SettingsPageShell({ title, loading, children }: SettingsPageShellProps) {
  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center py-4">
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        </PageBleedRow>
      </header>

      <PageMain>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="max-w-lg mx-auto space-y-4">{children}</div>
        )}
      </PageMain>
    </div>
  );
}
