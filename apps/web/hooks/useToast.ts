import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 2500;

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(message);
    timeoutRef.current = setTimeout(() => {
      setToast(null);
      timeoutRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  return { toast, showToast };
}
