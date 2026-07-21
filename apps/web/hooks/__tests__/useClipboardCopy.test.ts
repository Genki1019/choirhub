import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClipboardCopy } from "../useClipboardCopy";

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

describe("useClipboardCopy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初期状態ではcopiedKeyがnull", () => {
    stubClipboard();
    const { result } = renderHook(() => useClipboardCopy());
    expect(result.current.copiedKey).toBeNull();
  });

  it("copyを呼ぶとクリップボードに書き込み、copiedKeyがセットされる", () => {
    const writeText = stubClipboard();
    const { result } = renderHook(() => useClipboardCopy());
    act(() => {
      result.current.copy("コピー対象のテキスト", "url");
    });
    expect(writeText).toHaveBeenCalledWith("コピー対象のテキスト");
    expect(result.current.copiedKey).toBe("url");
  });

  it("一定時間後にcopiedKeyが自動でnullに戻る", () => {
    stubClipboard();
    const { result } = renderHook(() => useClipboardCopy());
    act(() => {
      result.current.copy("text", "url");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copiedKey).toBeNull();
  });

  it("resetを呼ぶと即座にcopiedKeyがnullに戻る", () => {
    stubClipboard();
    const { result } = renderHook(() => useClipboardCopy());
    act(() => {
      result.current.copy("text", "url");
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.copiedKey).toBeNull();
  });

  it("keyを省略した場合はdefaultキーが使われる", () => {
    stubClipboard();
    const { result } = renderHook(() => useClipboardCopy());
    act(() => {
      result.current.copy("text");
    });
    expect(result.current.copiedKey).toBe("default");
  });

  it("アンマウント後にタイマーが発火してもエラーにならない", () => {
    stubClipboard();
    const { result, unmount } = renderHook(() => useClipboardCopy());
    act(() => {
      result.current.copy("text", "url");
    });
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    }).not.toThrow();
  });
});
