import { useState } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { TokenResponse } from "@/lib/api-types";
import { userErrorMessage } from "@/lib/api-client";

// 「発行する/再発行する」ボタンでトークンを発行し、react-queryのキャッシュを更新する
// 共通フロー（visitor-webhook・カレンダーフィード等、トークン発行系画面で共用）
export function useTokenIssuance(
  queryKey: QueryKey,
  fetchToken: () => Promise<TokenResponse>,
  regenerateToken: () => Promise<TokenResponse>,
  options: { enabled?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey,
    queryFn: fetchToken,
    enabled: options.enabled,
  });

  const handleRegenerate = async (): Promise<boolean> => {
    setRegenerating(true);
    setError(null);
    try {
      const updated = await regenerateToken();
      queryClient.setQueryData(queryKey, updated);
      return true;
    } catch (err) {
      setError(userErrorMessage(err, "トークンの発行に失敗しました。もう一度お試しください。"));
      return false;
    } finally {
      setRegenerating(false);
    }
  };

  return {
    data,
    isLoading,
    loadError:
      fetchError && !data
        ? userErrorMessage(
            fetchError,
            "トークンの読み込みに失敗しました。ページを再読み込みしてください。",
          )
        : null,
    regenerating,
    error,
    handleRegenerate,
    clearError: () => setError(null),
  };
}
