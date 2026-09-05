import { apiClient, ApiClientError } from "./api-client";
import { uploadAttachment } from "./file-attachment-api";

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
  isCommissioned?: boolean;
  purchaseDate?: string | null;
  distributionStart?: string | null;
  purchasePrice?: number | null;
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

export interface ScoreDetail extends ScoreSummary {
  accessLevel: "secret" | "restricted" | "public";
  distributionPrice: number | null;
  canAccessFiles: boolean;
  canDownload: boolean;
  purchaseCount?: number;
  files: ScoreFile[];
  isCommissioned: boolean;
  purchaseDate: string | null;
  distributionStart: string | null;
  purchasePrice?: number | null;
  notes: string | null;
  hasCollection: boolean;
}

export interface UpdateScoreMetaInput {
  title?: string;
  composer?: string | null;
  arranger?: string | null;
  accessLevel?: "secret" | "restricted" | "public";
  isCommissioned?: boolean;
  purchaseDate?: string | null;
  distributionStart?: string | null;
  purchasePrice?: number | null;
  notes?: string | null;
}

export interface ScoreMetaResponse {
  id: string;
  title: string;
  composer: string | null;
  arranger: string | null;
  accessLevel: "secret" | "restricted" | "public";
  isCommissioned: boolean;
  purchaseDate: string | null;
  distributionStart: string | null;
  purchasePrice: number | null;
  notes: string | null;
}

export interface ScoreListItem {
  id: string;
  title: string;
  composer: string | null;
  arranger: string | null;
}

export interface ScoreListQuery {
  q?: string;
}

export const scoresApi = {
  grouped: (orgSlug: string) => apiClient.get<GroupedScores>(`/${orgSlug}/scores/grouped`),

  getDetail: (orgSlug: string, scoreId: string) =>
    apiClient.get<ScoreDetail>(`/${orgSlug}/scores/${scoreId}`),

  updateMeta: (orgSlug: string, scoreId: string, data: UpdateScoreMetaInput) =>
    apiClient.patch<ScoreMetaResponse>(`/${orgSlug}/scores/${scoreId}`, data),

  list: (orgSlug: string, query?: ScoreListQuery) => {
    const params = new URLSearchParams();
    if (query?.q) params.set("q", query.q);
    const qs = params.toString();
    return apiClient.get<ScoreListItem[]>(`/${orgSlug}/scores${qs ? `?${qs}` : ""}`);
  },

  create: (orgSlug: string, data: CreateScoreInput) =>
    apiClient.post<ScoreSummary>(`/${orgSlug}/scores`, data),

  getPurchases: (orgSlug: string, scoreId: string) =>
    apiClient.get<ScorePurchaseRecord[]>(`/${orgSlug}/scores/${scoreId}/purchases`),

  putPurchases: (
    orgSlug: string,
    scoreId: string,
    data: { memberIds: string[]; note?: string | null },
  ) => apiClient.put<{ updated: number }>(`/${orgSlug}/scores/${scoreId}/purchases`, data),

  setPrice: (orgSlug: string, scoreId: string, price: number | null) =>
    apiClient.patch<{ id: string; distributionPrice: number | null }>(
      `/${orgSlug}/scores/${scoreId}/price`,
      { price },
    ),

  uploadFile: async (orgSlug: string, scoreId: string, formData: FormData): Promise<ScoreFile> => {
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as string;
    const partId = (formData.get("partId") as string | null) || null;

    if (!file) throw new ApiClientError("BAD_REQUEST", "ファイルが選択されていません", 400);

    return uploadAttachment<ScoreFile>({
      presignPath: `/${orgSlug}/scores/${scoreId}/files/presign`,
      confirmPath: `/${orgSlug}/scores/${scoreId}/files/confirm`,
      fallbackPath: `/${orgSlug}/scores/${scoreId}/files`,
      file,
      presignExtra: { fileType, partId },
      confirmExtra: { fileType, partId },
      fallbackExtra: { fileType, ...(partId ? { partId } : {}) },
    });
  },

  deleteFile: (orgSlug: string, scoreId: string, fileId: string) =>
    apiClient.delete(`/${orgSlug}/scores/${scoreId}/files/${fileId}`),
};
