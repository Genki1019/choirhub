import { apiClient } from "./api-client";

export type CrossFileKind = "score" | "concert" | "event";

export interface CrossFileItem {
  id: string;
  kind: CrossFileKind;
  title: string;
  subtitle: string;
  fileName: string;
  downloadUrl: string;
  resourceLink: string;
}

export const filesApi = {
  list: (org: string, kind: CrossFileKind) =>
    apiClient.get<CrossFileItem[]>(`/${org}/files?kind=${kind}`),
};
