import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTokenIssuance } from "../useTokenIssuance";

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

    await act(async () => {
      await result.current.handleRegenerate();
    });

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

    await act(async () => {
      await result.current.handleRegenerate();
    });

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
});
