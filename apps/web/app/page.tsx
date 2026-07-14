import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { ScrollTopLink } from "@/components/ScrollTopLink";
import { Calendar, FileMusic, Star, Mail, Ticket, Wallet, ChevronRight, Users } from "lucide-react";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

async function getAuthenticatedOrgs(): Promise<{ orgSlug: string }[]> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");
    if (!sessionCookie?.value) return [];

    const res = await fetch(`${API}/api/v1/auth/me`, {
      headers: { Cookie: `session=${sessionCookie.value}` },
      cache: "no-store",
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { data: { orgs: { orgSlug: string }[] } };
    return data.data?.orgs ?? [];
  } catch {
    return [];
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
  const orgs = await getAuthenticatedOrgs();
  const loginHref = orgs.length === 0 ? "/login" : "/select-org";

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      {/* ナビゲーションバー */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <ScrollTopLink
            href="/"
            className="flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <Image
              src="/icons/app-icon.svg"
              alt="ChoirHub"
              width={32}
              height={32}
              unoptimized
              className="size-8 cursor-pointer"
            />
            <span className="cursor-pointer text-lg font-bold tracking-tight">ChoirHub</span>
          </ScrollTopLink>
          <Link
            href={loginHref}
            className="text-brand-600 hover:text-brand-700 text-sm font-medium transition-colors"
          >
            ログイン
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ヒーローセクション */}
        <section className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
          <div className="bg-brand-50 text-brand-700 border-brand-100 mb-8 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
            <Users size={12} />
            合唱団向け運営支援 SaaS
          </div>
          <h1 className="mb-6 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            合唱団の運営を、
            <br />
            <span className="text-brand-600">ひとつのツール</span>で完結。
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-gray-500">
            スケジュール管理から楽譜配布、本番準備、チケット、メーリス、会計まで。
            バラバラだった合唱団の業務をまとめて管理できます。
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={loginHref}
              className="bg-brand-600 hover:bg-brand-700 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-sm transition-colors sm:w-auto"
            >
              ログインしてはじめる
              <ChevronRight size={16} />
            </Link>
          </div>
        </section>

        {/* 機能紹介セクション */}
        <section className="border-y border-gray-100 bg-gray-50 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-3 text-center text-2xl font-bold">主な機能</h2>
            <p className="mb-12 text-center text-sm text-gray-500">
              合唱団運営のあらゆる業務をカバーします
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="bg-brand-50 mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
                    <Icon size={20} className="text-brand-600" />
                  </div>
                  <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA セクション */}
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h2 className="mb-4 text-2xl font-bold">今すぐ試してみる</h2>
          <p className="mb-8 text-sm text-gray-500">
            招待を受け取ったメンバーはこちらからログインできます
          </p>
          <Link
            href={loginHref}
            className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-2 rounded-xl px-8 py-3 font-semibold text-white shadow-sm transition-colors"
          >
            ログイン
            <ChevronRight size={16} />
          </Link>
        </section>
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-100 py-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-8 flex flex-col items-center justify-between gap-6 sm:flex-row">
            <ScrollTopLink
              href="/"
              className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Image
                src="/icons/app-icon.svg"
                alt="ChoirHub"
                width={24}
                height={24}
                unoptimized
                className="size-6 cursor-pointer"
              />
              <span className="cursor-pointer font-bold text-gray-800">ChoirHub</span>
            </ScrollTopLink>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
              <Link href="#" className="transition-colors hover:text-gray-700">
                プライバシーポリシー
              </Link>
              <Link href="#" className="transition-colors hover:text-gray-700">
                利用規約
              </Link>
              <Link href="#" className="transition-colors hover:text-gray-700">
                お問い合わせ
              </Link>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
            <p>&copy; 2026 ChoirHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
