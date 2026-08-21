import { apiClient, ApiClientError } from "./api-client";

export interface LoginResult {
  user: {
    id: string;
    nameJa: string;
    email: string;
    avatarUrl: string | null;
    isSystemAdmin: boolean;
  };
  orgs: {
    orgSlug: string;
    orgName: string;
    roles: string[];
    partName: string | null;
    status: string;
  }[];
}

export interface MeResult {
  user: LoginResult["user"];
  orgs: (LoginResult["orgs"][number] & { memberId: string })[];
}

export interface InviteInfo {
  email: string;
  nameJa: string | null;
  orgName: string;
  orgSlug: string;
  expiresAt: string;
  isExistingUser: boolean;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResult>("/auth/login", { email, password }),

  logout: () => apiClient.post<void>("/auth/logout", {}),

  me: () => apiClient.get<MeResult>("/auth/me"),

  getInvite: (token: string) => apiClient.get<InviteInfo>(`/auth/invite/${token}`),

  acceptInvite: (token: string, data: { nameJa?: string; password: string }) =>
    apiClient.post<{ message: string; orgSlug?: string }>(`/auth/invite/${token}`, data),

  requestPasswordReset: (email: string) =>
    apiClient.post<{ message: string }>("/auth/password-reset/request", { email }),

  getPasswordResetToken: (token: string) =>
    apiClient.get<{ email: string }>(`/auth/password-reset/${token}`),

  confirmPasswordReset: (token: string, password: string) =>
    apiClient.post<{ message: string }>(`/auth/password-reset/${token}`, { password }),
};

export { ApiClientError };
