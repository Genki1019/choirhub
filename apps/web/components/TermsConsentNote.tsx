import Link from "next/link";

export function TermsConsentNote({ action }: { action: string }) {
  return (
    <p className="text-center text-xs text-gray-400">
      {action}することで、
      <Link href="/terms" target="_blank" className="text-brand-500 hover:underline">
        利用規約
      </Link>
      と
      <Link href="/privacy" target="_blank" className="text-brand-500 hover:underline">
        プライバシーポリシー
      </Link>
      に同意したものとみなします。
    </p>
  );
}
