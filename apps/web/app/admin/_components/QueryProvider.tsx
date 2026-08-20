"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => createAppQueryClient(() => router.push("/login")));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
