"use client";

import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X, Check } from "lucide-react";
import { visitorApplicationsApi } from "@/lib/visitor-applications-api";
import { addVisitorApplicationSchema, type AddVisitorApplicationInput } from "@/lib/schemas";

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";
const ERROR_CLS = "text-xs text-red-500 mt-1";

interface AddVisitorApplicationModalProps {
  org: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddVisitorApplicationModal({
  org,
  onClose,
  onSuccess,
}: AddVisitorApplicationModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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
      onSuccess();
    } catch {
      setError("root", { message: "見学申込の登録に失敗しました。もう一度お試しください。" });
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">見学者を追加</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
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
            <label
              htmlFor="visitor-partHope"
              className="mb-1 block text-xs font-medium text-gray-500"
            >
              希望パート
            </label>
            <input
              id="visitor-partHope"
              className={INPUT_CLS}
              placeholder="テノール"
              {...register("partHope")}
            />
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
            <label
              htmlFor="visitor-contact"
              className="mb-1 block text-xs font-medium text-gray-500"
            >
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
            <label
              htmlFor="visitor-message"
              className="mb-1 block text-xs font-medium text-gray-500"
            >
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

          {errors.root && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              登録する
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddVisitorApplicationSuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <Check size={40} className="mx-auto text-teal-500" />
        <p className="text-base font-semibold text-gray-800">見学申込を登録しました</p>
        <p className="text-sm text-gray-500">管理者が承認すると、団員へ紹介が共有されます。</p>
        <button
          onClick={onClose}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-lg py-2.5 text-sm font-medium text-white transition"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
