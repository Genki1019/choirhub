"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Check } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ErrorMessage } from "@/components/ErrorMessage";
import { visitorApplicationsApi } from "@/lib/visitor-applications-api";
import type { PartSummary } from "@/lib/members-api";
import { addVisitorApplicationSchema, type AddVisitorApplicationInput } from "@/lib/schemas";

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";
const ERROR_CLS = "text-xs text-red-500 mt-1";

interface AddVisitorApplicationModalProps {
  org: string;
  parts: PartSummary[];
  onClose: () => void;
}

export function AddVisitorApplicationModal({
  org,
  parts,
  onClose,
}: AddVisitorApplicationModalProps) {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddVisitorApplicationInput>({
    resolver: zodResolver(addVisitorApplicationSchema),
  });

  const onSubmit = async (data: AddVisitorApplicationInput) => {
    try {
      await visitorApplicationsApi.create(org, {
        name: data.name,
        partHope: data.partHope || undefined,
        originGroup: data.originGroup || undefined,
        contact: data.contact || undefined,
        message: data.message || undefined,
      });
      setSent(true);
    } catch {
      setError("root", { message: "見学申込の登録に失敗しました。もう一度お試しください。" });
    }
  };

  if (sent) {
    return (
      <Modal
        title="見学申込を登録しました"
        onClose={onClose}
        size="sm"
        footer={
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            閉じる
          </button>
        }
      >
        <p role="status" className="text-sm text-gray-500">
          管理者が承認すると、団員へ紹介が共有されます。
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="見学者を追加"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      busy={isSubmitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            登録する
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="visitor-name" className="mb-1 block text-xs font-medium text-gray-500">
          お名前 <span className="text-red-400">*</span>
        </label>
        <input
          id="visitor-name"
          className={INPUT_CLS}
          placeholder="山田 太郎"
          {...register("name")}
        />
        {errors.name && <p className={ERROR_CLS}>{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="visitor-partHope" className="mb-1 block text-xs font-medium text-gray-500">
          希望パート
        </label>
        <select id="visitor-partHope" className={INPUT_CLS} {...register("partHope")}>
          <option value="">未定</option>
          {parts.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="visitor-originGroup"
          className="mb-1 block text-xs font-medium text-gray-500"
        >
          出身団体
        </label>
        <input
          id="visitor-originGroup"
          className={INPUT_CLS}
          placeholder="○○大学グリークラブ"
          {...register("originGroup")}
        />
      </div>

      <div>
        <label htmlFor="visitor-contact" className="mb-1 block text-xs font-medium text-gray-500">
          連絡先
        </label>
        <input
          id="visitor-contact"
          className={INPUT_CLS}
          placeholder="メールアドレス・電話番号など"
          {...register("contact")}
        />
      </div>

      <div>
        <label htmlFor="visitor-message" className="mb-1 block text-xs font-medium text-gray-500">
          コメント
        </label>
        <textarea
          id="visitor-message"
          rows={3}
          className={INPUT_CLS}
          placeholder="紹介コメントなど"
          {...register("message")}
        />
      </div>

      <ErrorMessage>{errors.root?.message}</ErrorMessage>
    </Modal>
  );
}
