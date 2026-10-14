import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTokenIssuance } from "../useTokenIssuance";
import { ApiClientError } from "@/lib/api-client";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useTokenIssuance", () => {
  it("初期表示でfetchTokenの結果を返す", async () => {
    const fetchToken = vi.fn().mockResolvedValue({ token: null });
    const regenerateToken = vi.fn();

    const { result } = renderHook(
      () => useTokenIssuance(["test-token"], fetchToken, regenerateToken),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ token: null });
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("handleRegenerate成功: dataがキャッシュ経由で更新される", async () => {
    const fetchToken = vi.fn().mockResolvedValue({ token: null });
    const regenerateToken = vi.fn().mockResolvedValue({ token: "new-token" });

    const { result } = renderHook(
      () => useTokenIssuance(["test-token"], fetchToken, regenerateToken),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.handleRegenerate();
    });

    expect(succeeded).toBe(true);
    expect(result.current.data).toEqual({ token: "new-token" });
    expect(result.current.regenerating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handleRegenerate失敗: errorがセットされregeneratingがfalseに戻る", async () => {
    const fetchToken = vi.fn().mockResolvedValue({ token: null });
    const regenerateToken = vi.fn().mockRejectedValue(new Error("network error"));

    const { result } = renderHook(
      () => useTokenIssuance(["test-token"], fetchToken, regenerateToken),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.handleRegenerate();
    });

    expect(succeeded).toBe(false);
    expect(result.current.error).toBe("トークンの発行に失敗しました。もう一度お試しください。");
    expect(result.current.regenerating).toBe(false);
  });

  it("enabled: falseの場合はfetchTokenが呼ばれない", async () => {
    const fetchToken = vi.fn().mockResolvedValue({ token: null });
    const regenerateToken = vi.fn();

    const { result } = renderHook(
      () => useTokenIssuance(["test-token"], fetchToken, regenerateToken, { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(fetchToken).not.toHaveBeenCalled();
  });

  it("取得に失敗したら loadError に理由を返す（4xx は API の理由）", async () => {
    const fetchToken = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useTokenIssuance(["test-token"], fetchToken, vi.fn()), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.loadError).toBe(
        "トークンの読み込みに失敗しました。ページを再読み込みしてください。",
      ),
    );
    expect(result.current.data).toBeUndefined();
  });

  it("発行の 4xx は API の理由をそのまま返す", async () => {
    const regenerateToken = vi
      .fn()
      .mockRejectedValue(new ApiClientError("FORBIDDEN", "管理者のみ実行できます", 403));
    const { result } = renderHook(
      () =>
        useTokenIssuance(
          ["test-token"],
          vi.fn().mockResolvedValue({ token: null }),
          regenerateToken,
        ),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleRegenerate();
    });

    expect(result.current.error).toBe("管理者のみ実行できます");
  });

  it("一度取得できたあとの再取得の失敗では、表示中のトークンを隠さない", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ token: "tok" })
      .mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useTokenIssuance(["test-token"], fetchToken, vi.fn()), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.data).toEqual({ token: "tok" }));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["test-token"] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(queryClient.getQueryState(["test-token"])?.status).toBe("error");

    expect(fetchToken).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual({ token: "tok" });
    expect(result.current.loadError).toBeNull();
  });
});
