import { apiClient, ApiClientError } from "./api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface AttachmentFile {
  id: string;
  label: string;
  fileName: string;
  downloadUrl?: string;
}

/**
 * Concert/Event/Score等の添付ファイルをアップロードする（R2プレサインドURL経由、未設定時はマルチパートにフォールバック）。
 * presign → PUT → confirm の3段階（またはフォールバック時は1段階のmultipart POST）を汎用化したもの。
 * `label`（Concert/Event）・`fileType`/`partId`（Score）等、リソースごとに異なる付随フィールドは
 * presign/confirm のJSONボディ・フォールバックのFormDataそれぞれに個別に渡す。
 */
export async function uploadAttachment<T = AttachmentFile>(params: {
  presignPath: string;
  confirmPath: string;
  fallbackPath: string;
  file: File;
  presignExtra?: Record<string, unknown>;
  confirmExtra?: Record<string, unknown>;
  fallbackExtra?: Record<string, string>;
}): Promise<T> {
  const {
    presignPath,
    confirmPath,
    fallbackPath,
    file,
    presignExtra,
    confirmExtra,
    fallbackExtra,
  } = params;

  const presignData = await apiClient.post<{
    presignedUrl: string | null;
    key: string;
    contentType: string;
  }>(presignPath, {
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    ...presignExtra,
  });

  if (presignData.presignedUrl) {
    // サーバーが署名したContentTypeと完全に一致させる（不一致だとR2の署名検証で弾かれる）
    const uploadRes = await fetch(presignData.presignedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": presignData.contentType },
    });
    if (!uploadRes.ok) {
      throw new ApiClientError(
        "UPLOAD_FAILED",
        `R2へのアップロードに失敗しました (${uploadRes.status})`,
        uploadRes.status,
      );
    }

    return apiClient.post<T>(confirmPath, {
      key: presignData.key,
      fileName: file.name,
      ...confirmExtra,
    });
  }

  const formData = new FormData();
  formData.append("file", file);
  Object.entries(fallbackExtra ?? {}).forEach(([k, v]) => formData.append(k, v));

  const res = await fetch(`${API_BASE}/api/v1${fallbackPath}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code: string; message: string };
    } | null;
    throw new ApiClientError(
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? res.statusText,
      res.status,
    );
  }
  const body = (await res.json()) as { data: T };
  return body.data;
}
