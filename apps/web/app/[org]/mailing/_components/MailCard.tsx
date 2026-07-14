import Image from "next/image";
import Link from "next/link";
import { Users } from "lucide-react";
import { type MailSummary } from "@/lib/mailing-api";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (days < 7) return `${days}日前`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function SenderAvatar({ nameJa, avatarUrl }: { nameJa: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={nameJa}
        width={36}
        height={36}
        className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="bg-brand-100 text-brand-600 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
      {nameJa.charAt(0)}
    </div>
  );
}

export interface MailCardProps {
  mail: MailSummary;
  org: string;
}

export function MailCard({ mail, org }: MailCardProps) {
  return (
    <Link
      href={`/${org}/mailing/${mail.id}`}
      prefetch={false}
      className="block border-b border-gray-100 px-6 py-4 transition-colors last:border-0 hover:bg-gray-50"
    >
      <div className="flex items-start gap-4">
        <SenderAvatar nameJa={mail.sentBy.nameJa} avatarUrl={mail.sentBy.avatarUrl} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-gray-800">
              {mail.subject || <span className="text-gray-400 italic">（件名なし）</span>}
            </span>
            <span className="shrink-0 text-xs text-gray-400">{formatDate(mail.sentAt)}</span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{mail.sentBy.nameJa}</span>
            {mail.recipientCount > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Users size={10} />
                  {mail.recipientCount}名
                </span>
              </>
            )}
          </div>

          {mail.bodyPreview && (
            <p className="mt-1 truncate text-xs text-gray-400">{mail.bodyPreview}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
