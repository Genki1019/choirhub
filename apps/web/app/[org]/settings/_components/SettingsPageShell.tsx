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
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center py-4">
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        </PageBleedRow>
      </header>

      <PageMain>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-4">{children}</div>
        )}
      </PageMain>
    </div>
  );
}
