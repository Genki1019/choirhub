import { apiClient } from "./api-client";

export interface DeletedOrg {
  id: string;
  name: string;
  slug: string;
  deletedAt: string;
  deletedByEmail: string | null;
  purgeScheduledAt: string;
}

export const deletedOrgsApi = {
  list: () => apiClient.get<DeletedOrg[]>("/auth/orgs/deleted"),

  restore: (id: string) =>
    apiClient.post<{ id: string; name: string; slug: string }>(`/auth/orgs/${id}/restore`, {}),
};
