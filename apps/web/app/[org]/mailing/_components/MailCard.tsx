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
  if (days < 7)  return `${days}日前`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function SenderAvatar({ nameJa, avatarUrl }: { nameJa: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <Image src={avatarUrl} alt={nameJa} width={36} height={36} className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5" unoptimized />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
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
      className="block px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
    >
      <div className="flex items-start gap-4">
        <SenderAvatar nameJa={mail.sentBy.nameJa} avatarUrl={mail.sentBy.avatarUrl} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">
              {mail.subject || <span className="text-gray-400 italic">（件名なし）</span>}
            </span>
            <span className="text-xs text-gray-400 shrink-0">{formatDate(mail.sentAt)}</span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{mail.sentBy.nameJa}</span>
            {mail.recipientCount > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Users size={10} />{mail.recipientCount}名
                </span>
              </>
            )}
          </div>

          {mail.bodyPreview && (
            <p className="text-xs text-gray-400 truncate mt-1">{mail.bodyPreview}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
