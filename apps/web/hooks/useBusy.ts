import { useState } from "react";

export function useBusy() {
  const [busy, setBusy] = useState(false);

  const runBusy = async <T>(task: () => Promise<T>) => {
    setBusy(true);
    try {
      return await task();
    } finally {
      setBusy(false);
    }
  };

  return { busy, setBusy, runBusy };
}
