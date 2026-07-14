import Link from "next/link";
import Image from "next/image";

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-gray-100 bg-white py-5">
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/"
          className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80"
        >
          <Image
            src="/icons/app-icon.svg"
            alt="ChoirHub"
            width={24}
            height={24}
            unoptimized
            className="size-6 cursor-pointer"
          />
          <span className="cursor-pointer text-base font-bold text-gray-700">ChoirHub</span>
        </Link>
        <div className="flex flex-col items-center gap-1.5 text-xs text-gray-400">
          <Link href="#" className="transition-colors hover:text-gray-600">
            プライバシーポリシー
          </Link>
          <Link href="#" className="transition-colors hover:text-gray-600">
            利用規約
          </Link>
          <Link href="#" className="transition-colors hover:text-gray-600">
            お問い合わせ
          </Link>
        </div>
        <p className="text-xs text-gray-400">&copy; 2026 ChoirHub. All rights reserved.</p>
      </div>
    </footer>
  );
}
