const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type ApiResponse<T> = { data: T };
type ApiError = { error: { code: string; message: string } };

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function toApiClientError(res: Response): Promise<ApiClientError> {
  const body = (await res.json().catch(() => null)) as ApiError | null;
  return new ApiClientError(
    body?.error.code ?? "UNKNOWN",
    body?.error.message ?? res.statusText,
    res.status,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
    credentials: "include",
  });

  if (!res.ok) throw await toApiClientError(res);

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiResponse<T>;
  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

function filenameFromDisposition(header: string | null): string | null {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return encoded ? decodeURIComponent(encoded) : null;
}

export async function downloadFile(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, { credentials: "include" });
  if (!res.ok) throw await toApiClientError(res);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? "export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
