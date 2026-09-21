import { apiClient } from "./api-client";
import { uploadAttachment } from "./file-attachment-api";

export type DocumentCategory = "bylaws" | "minutes" | "member_guide" | "finance_report" | "other";

export type DocumentAccessLevel = "secret" | "restricted" | "public";

export interface OrgDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  accessLevel: DocumentAccessLevel;
  fileName: string;
  downloadUrl: string;
}

export const documentsApi = {
  list: (org: string, category?: DocumentCategory) =>
    apiClient.get<OrgDocument[]>(`/${org}/documents${category ? `?category=${category}` : ""}`),

  upload: (
    org: string,
    file: File,
    data: { title: string; category: DocumentCategory; accessLevel: DocumentAccessLevel },
  ) =>
    uploadAttachment<OrgDocument>({
      presignPath: `/${org}/documents/presign`,
      confirmPath: `/${org}/documents/confirm`,
      fallbackPath: `/${org}/documents`,
      file,
      presignExtra: { category: data.category },
      confirmExtra: { title: data.title, category: data.category, accessLevel: data.accessLevel },
      fallbackExtra: {
        title: data.title,
        category: data.category,
        accessLevel: data.accessLevel,
      },
    }),

  delete: (org: string, id: string) => apiClient.delete(`/${org}/documents/${id}`),
};
