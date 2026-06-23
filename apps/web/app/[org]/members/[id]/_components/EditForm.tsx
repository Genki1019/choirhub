"use client";

import { useState, useRef, useEffect, type ChangeEvent, type ReactNode } from "react";
import Image from "next/image";
import { Camera, X, Check, Loader2 } from "lucide-react";
import type { MemberProfile } from "@/lib/members-api";
import { avatarColor } from "../../_components/MemberCard";

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

interface EditFormProps {
  member: MemberProfile;
  org: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function EditForm({ member, org, onSave, onCancel }: EditFormProps) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const [form, setForm] = useState({
    nameJa:      member.nameJa,
    nameKana:    member.nameKana    ?? "",
    email:       member.email       ?? "",
    bio:         member.bio         ?? "",
    job:         member.job         ?? "",
    interests:   member.interests   ?? "",
    originGroup: member.originGroup ?? "",
    phone:       member.phone       ?? "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(member.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    blobUrlRef.current = objectUrl;
    setAvatarPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/v1/${org}/members/me/avatar`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json() as { error?: { message?: string } };
        throw new Error(json.error?.message ?? "アップロードに失敗しました");
      }

      // アバターはアップロード時点でDBが更新済み。プレビューのみ更新する。
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました");
      setAvatarPreview(member.avatarUrl ?? null);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        nameJa:      form.nameJa      || undefined,
        nameKana:    form.nameKana    || null,
        email:       form.email       || undefined,
        bio:         form.bio         || null,
        job:         form.job         || null,
        interests:   form.interests   || null,
        originGroup: form.originGroup || null,
        phone:       form.phone       || null,
        // avatarUrl は POST /members/me/avatar で既にDBが更新済みなので PATCH に含めない
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-blue-200 p-6 space-y-5">
      <h3 className="text-sm font-semibold text-gray-700">プロフィール編集</h3>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => !uploading && fileRef.current?.click()}
          className="relative group"
          disabled={uploading}
        >
          {avatarPreview ? (
            <Image src={avatarPreview} alt="preview" width={80} height={80} unoptimized className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className={`w-20 h-20 rounded-full ${avatarColor(member.id)} flex items-center justify-center text-white text-2xl font-bold`}>
              {member.nameJa.charAt(0)}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            {uploading
              ? <Loader2 size={20} className="text-white animate-spin" />
              : <Camera size={20} className="text-white" />
            }
          </div>
        </button>
        <p className="text-xs text-gray-400">
          {uploading ? "アップロード中..." : "クリックして写真を変更（JPEG / PNG / WebP・4MB以内）"}
        </p>
        {uploadError && (
          <p className="text-xs text-red-500">{uploadError}</p>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="氏名">
          <input className={INPUT_CLS} {...field("nameJa")} />
        </FormField>
        <FormField label="カナ">
          <input className={INPUT_CLS} {...field("nameKana")} />
        </FormField>
      </div>

      <FormField label="ひとこと">
        <textarea className={`${INPUT_CLS} resize-none`} rows={3} maxLength={200}
          placeholder="自己紹介など自由に書いてください！" {...field("bio")} />
        <p className="text-xs text-gray-400 text-right mt-0.5">{form.bio.length}/200</p>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="職業">
          <input className={INPUT_CLS} placeholder="例: エンジニア" {...field("job")} />
        </FormField>
        <FormField label="好きなもの">
          <input className={INPUT_CLS} placeholder="例: コーヒー" {...field("interests")} />
        </FormField>
      </div>

      <FormField label="出身団体">
        <input className={INPUT_CLS} placeholder="例: ○○大学混声合唱団" {...field("originGroup")} />
      </FormField>

      <div className="pt-1 border-t border-gray-100 space-y-3">
        <p className="text-xs font-semibold text-gray-500">連絡先</p>
        <FormField label="メールアドレス">
          <input className={INPUT_CLS} type="email" placeholder="example@mail.com" {...field("email")} />
        </FormField>
        <FormField label="電話番号">
          <input className={INPUT_CLS} placeholder="090-xxxx-xxxx" type="tel" {...field("phone")} />
        </FormField>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          保存する
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-gray-500 text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          <X size={14} /> キャンセル
        </button>
      </div>
    </div>
  );
}
