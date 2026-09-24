import type { Metadata } from "next";
import { InquiryForm } from "@/components/InquiryForm";
import { isInquiryCategory } from "@/lib/inquiries-api";

export const metadata: Metadata = { title: "お問い合わせ | ChoirHub" };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { category } = await searchParams;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-xl font-bold text-gray-900">お問い合わせ</h1>
      <p className="mb-6 text-sm text-gray-500">
        ChoirHub
        運営へのお問い合わせはこちらからお送りください。団体内の運用（出欠・楽譜・会計など）に関するご質問は、所属団体の管理者にお問い合わせください。
      </p>
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6">
        <InquiryForm initialCategory={isInquiryCategory(category) ? category : undefined} />
      </div>
    </div>
  );
}
