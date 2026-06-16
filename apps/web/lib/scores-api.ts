import { apiClient, ApiClientError } from "./api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface ScoreFile {
  id: string;
  fileType: "full_score" | "part_score" | "midi" | "audio" | "other";
  fileName: string;
  partId: string | null;
  partName: string | null;
  version: number;
  downloadUrl?: string;
}

export interface ScoreSummary {
  id: string;
  title: string;
  composer: string | null;
  arranger: string | null;
  accessLevel: "secret" | "restricted" | "public";
  distributionPrice: number | null;
  canAccessFiles: boolean;
  canDownload: boolean;
  files: ScoreFile[];
}

export interface ProgramWithScore {
  id: string;
  title: string;
  sortOrder: number;
  score: ScoreSummary | null;
}

export interface StageSummary {
  id: string;
  name: string;
  sortOrder: number;
  programs: ProgramWithScore[];
}

export interface ConcertWithScores {
  id: string;
  title: string;
  heldOn: string;
  venue: string | null;
  status: string;
  stages: StageSummary[];
}

export interface GroupedScores {
  concerts: ConcertWithScores[];
  unassigned: ScoreSummary[];
}

export interface CreateScoreInput {
  title: string;
  composer?: string | null;
  arranger?: string | null;
  accessLevel?: "secret" | "restricted" | "public";
  notes?: string | null;
}

export interface ScorePurchaseRecord {
  memberId: string;
  nameJa: string;
  partName: string | null;
  purchasedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface ScoreListItem {
  id: string;
  title: string;
  composer: string | null;
  arranger: string | null;
}

export const scoresApi = {
  grouped: (orgSlug: string) =>
    apiClient.get<GroupedScores>(`/${orgSlug}/scores/grouped`),

  list: (orgSlug: string) =>
    apiClient.get<ScoreListItem[]>(`/${orgSlug}/scores`),

  create: (orgSlug: string, data: CreateScoreInput) =>
    apiClient.post<ScoreSummary>(`/${orgSlug}/scores`, data),

  getPurchases: (orgSlug: string, scoreId: string) =>
    apiClient.get<ScorePurchaseRecord[]>(`/${orgSlug}/scores/${scoreId}/purchases`),

  putPurchases: (orgSlug: string, scoreId: string, data: { memberIds: string[]; note?: string | null }) =>
    apiClient.put<{ updated: number }>(`/${orgSlug}/scores/${scoreId}/purchases`, data),

  setPrice: (orgSlug: string, scoreId: string, price: number | null) =>
    apiClient.patch<{ id: string; distributionPrice: number | null }>(`/${orgSlug}/scores/${scoreId}/price`, { price }),

  uploadFile: async (orgSlug: string, scoreId: string, formData: FormData): Promise<ScoreFile> => {
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as string;
    const partId = (formData.get("partId") as string | null) || null;

    if (!file) throw new ApiClientError("BAD_REQUEST", "ファイルが選択されていません", 400);

    // Step 1: プレサインド PUT URL を取得
    const presignData = await apiClient.post<{ presignedUrl: string | null; key: string }>(
      `/${orgSlug}/scores/${scoreId}/files/presign`,
      {
        fileType,
        fileName: file.name,
        partId,
        contentType: file.type || "application/octet-stream",
      }
    );

    if (presignData.presignedUrl) {
      // Step 2: R2 に直接アップロード（Lambda を通さないので 4.5MB 制限なし）
      const uploadRes = await fetch(presignData.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!uploadRes.ok) {
        throw new ApiClientError("UPLOAD_FAILED", `R2へのアップロードに失敗しました (${uploadRes.status})`, uploadRes.status);
      }

      // Step 3: API に DB 登録を依頼
      return apiClient.post<ScoreFile>(
        `/${orgSlug}/scores/${scoreId}/files/confirm`,
        { key: presignData.key, fileType, fileName: file.name, partId }
      );
    }

    // R2 未設定（ローカル開発）: 従来のマルチパート方式にフォールバック
    const res = await fetch(`${API_BASE}/api/v1/${orgSlug}/scores/${scoreId}/files`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: { code: string; message: string } } | null;
      throw new ApiClientError(
        body?.error?.code ?? "UNKNOWN",
        body?.error?.message ?? res.statusText,
        res.status,
      );
    }
    const body = await res.json() as { data: ScoreFile };
    return body.data;
  },

  deleteFile: (orgSlug: string, scoreId: string, fileId: string) =>
    apiClient.delete(`/${orgSlug}/scores/${scoreId}/files/${fileId}`),
};
