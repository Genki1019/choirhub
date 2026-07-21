import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_DURATION_MS = 2000;

// クリップボードへのコピーと、一定時間後に自動で消える完了表示をまとめて扱うフック。
// 複数のコピーボタンを1画面に置く場合は key で対象を区別する。
export function useClipboardCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCopiedKey(null);
  }, []);

  const copy = useCallback((text: string, key: string = "default") => {
    navigator.clipboard.writeText(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCopiedKey(key);
    timeoutRef.current = setTimeout(() => {
      setCopiedKey(null);
      timeoutRef.current = null;
    }, COPIED_DURATION_MS);
  }, []);

  return { copiedKey, copy, reset };
}
