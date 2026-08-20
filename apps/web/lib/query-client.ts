import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./api-client";

export function createAppQueryClient(onUnauthorized: () => void): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiClientError && error.status === 401) {
          onUnauthorized();
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: false,
      },
    },
  });
}
