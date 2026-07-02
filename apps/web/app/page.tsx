import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  FileMusic,
  Star,
  Mail,
  Ticket,
  Wallet,
  ChevronRight,
  Users,
} from "lucide-react";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

async function getAuthenticatedOrg(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");
    if (!sessionCookie?.value) return null;

    const res = await fetch(`${API}/api/v1/auth/me`, {
      headers: { Cookie: `session=${sessionCookie.value}` },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { data: { orgs: { orgSlug: string }[] } };
    return data.data?.orgs?.[0]?.orgSlug ?? null;
  } catch {
    return null;
  }
}

const FEATURES = [
  {
    icon: Calendar,
    title: "スケジュール・出欠管理",
    desc: "練習・本番のスケジュールを一元管理。出欠確認を伝助スタイルの一覧表で把握できます。",
  },
  {
    icon: FileMusic,
    title: "楽譜・MIDI管理",
    desc: "楽譜PDFとMIDIファイルをクラウドで管理。ロール別アクセス制御と配布価格設定に対応。",
  },
  {
    icon: Star,
    title: "本番・オンステ管理",
    desc: "演奏会のステージ構成・プログラム管理。オンステ調査と出演メンバーの可視化。",
  },
  {
    icon: Mail,
    title: "メーリス",
    desc: "団員全員または特定グループへのメール送信。送信履歴・開封ステータスを確認できます。",
  },
  {
    icon: Ticket,
    title: "チケット管理・パートレース",
    desc: "席種・枚数の管理から販売・回収報告まで対応。パート別・個人別のポイントランキングも表示。",
  },
  {
    icon: Wallet,
    title: "会計管理",
    desc: "収支サマリー・支出管理・会費徴収を一括管理。年度フィルタとカテゴリ別集計に対応。",
  },
];

export default async function RootPage() {
  const orgSlug = await getAuthenticatedOrg();
  if (orgSlug) redirect(`/${orgSlug}`);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* ナビゲーションバー */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/icons/app-icon.svg" alt="ChoirHub" width={32} height={32} unoptimized className="size-8" />
            <span className="font-bold text-lg tracking-tight">ChoirHub</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            ログイン
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ヒーローセクション */}
        <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 border border-blue-100">
            <Users size={12} />
            合唱団向け運営支援 SaaS
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-6">
            合唱団の運営を、<br />
            <span className="text-blue-600">ひとつのツール</span>で完結。
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            スケジュール管理から楽譜配布、本番準備、チケット、メーリス、会計まで。
            バラバラだった合唱団の業務をまとめて管理できます。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              ログインしてはじめる
              <ChevronRight size={16} />
            </Link>
          </div>
        </section>

        {/* 機能紹介セクション */}
        <section className="bg-gray-50 border-y border-gray-100 py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center mb-3">主な機能</h2>
            <p className="text-gray-500 text-sm text-center mb-12">
              合唱団運営のあらゆる業務をカバーします
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                    <Icon size={20} className="text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA セクション */}
        <section className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-bold mb-4">今すぐ試してみる</h2>
          <p className="text-gray-500 text-sm mb-8">
            招待を受け取ったメンバーはこちらからログインできます
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            ログイン
            <ChevronRight size={16} />
          </Link>
        </section>
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2">
              <Image src="/icons/app-icon.svg" alt="ChoirHub" width={24} height={24} unoptimized className="size-6" />
              <span className="font-bold text-gray-800">ChoirHub</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
              <Link href="#" className="hover:text-gray-700 transition-colors">プライバシーポリシー</Link>
              <Link href="#" className="hover:text-gray-700 transition-colors">利用規約</Link>
              <Link href="#" className="hover:text-gray-700 transition-colors">お問い合わせ</Link>
            </div>
          </div>
          <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
            <p>&copy; 2026 ChoirHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
