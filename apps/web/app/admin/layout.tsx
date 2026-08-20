import { redirect } from "next/navigation";
import { fetchSessionMe } from "@/lib/session-guard";
import { LogoutButton } from "./_components/LogoutButton";
import { QueryProvider } from "./_components/QueryProvider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const payload = await fetchSessionMe();
    if (!payload.data?.user?.isSystemAdmin) {
      redirect("/select-org");
    }
  } catch (e) {
    // Next.js の redirect() は内部的に例外をスローするため再スロー
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-gray-800">システム管理者コンソール</p>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <QueryProvider>{children}</QueryProvider>
      </main>
    </div>
  );
}
