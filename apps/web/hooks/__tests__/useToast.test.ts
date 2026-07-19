import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "../useToast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初期状態ではtoastがnull", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it("showToastを呼ぶとtoastにメッセージがセットされる", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("保存しました");
    });
    expect(result.current.toast).toBe("保存しました");
  });

  it("一定時間後にtoastが自動でnullに戻る", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("保存しました");
    });
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.toast).toBeNull();
  });

  it("時間経過前はtoastが維持される", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("保存しました");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.toast).toBe("保存しました");
  });

  it("時間経過前に連続でshowToastを呼ぶと後のメッセージが先のタイマーで消えない", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("1件目");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
      result.current.showToast("2件目");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.toast).toBe("2件目");
  });

  it("アンマウント後にタイマーが発火してもエラーにならない", () => {
    const { result, unmount } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("保存しました");
    });
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(2500);
      });
    }).not.toThrow();
  });
});
