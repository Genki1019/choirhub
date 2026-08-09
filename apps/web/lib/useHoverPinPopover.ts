"use client";

import { useEffect, useRef, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";

// ホバーでプレビュー表示、クリックで開いたままにする（ホバーが外れても閉じない）、
// 外側クリックで閉じる、という一般的なポップオーバーの挙動をまとめたフック
export function useHoverPinPopover(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState<"closed" | "hover" | "pinned">("closed");
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  useClickOutside(containerRef, () => setState("closed"), state !== "closed");

  useEffect(() => cancelPendingClose, []);

  return {
    isOpen: state !== "closed",
    containerProps: {
      onMouseEnter: () => {
        cancelPendingClose();
        setState((s) => (s === "closed" ? "hover" : s));
      },
      // ボタンとポップオーバーの間のわずかな隙間でカーソルが要素の外を通過すると
      // すぐ閉じてしまうため、少し待ってから閉じる（その間に再びホバーされたら閉じない）
      onMouseLeave: () => {
        cancelPendingClose();
        closeTimeoutRef.current = setTimeout(() => {
          setState((s) => (s === "hover" ? "closed" : s));
        }, 200);
      },
    },
    triggerProps: {
      onClick: () => {
        cancelPendingClose();
        setState("pinned");
      },
    },
    close: () => {
      cancelPendingClose();
      setState("closed");
    },
  };
}
