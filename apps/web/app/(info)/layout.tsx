import Link from "next/link";
import Image from "next/image";
import { AppFooter } from "@/components/AppFooter";

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
          <Link href="/" className="flex items-center gap-1.5 transition-opacity hover:opacity-80">
            <Image
              src="/icons/app-icon.svg"
              alt=""
              width={24}
              height={24}
              unoptimized
              className="size-6"
            />
            <span className="text-base font-bold text-gray-700">ChoirHub</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      <AppFooter />
    </div>
  );
}
