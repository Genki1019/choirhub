import Link from "next/link";
import Image from "next/image";

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-gray-100 bg-white py-5">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Image src="/icons/app-icon.svg" alt="ChoirHub" width={24} height={24} unoptimized className="size-6" />
          <span className="text-base font-bold text-gray-700">ChoirHub</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-xs text-gray-400">
          <Link href="#" className="hover:text-gray-600 transition-colors">プライバシーポリシー</Link>
          <Link href="#" className="hover:text-gray-600 transition-colors">利用規約</Link>
          <Link href="#" className="hover:text-gray-600 transition-colors">お問い合わせ</Link>
        </div>
        <p className="text-xs text-gray-400">&copy; 2026 ChoirHub. All rights reserved.</p>
      </div>
    </footer>
  );
}
