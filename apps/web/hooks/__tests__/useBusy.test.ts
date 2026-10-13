import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBusy } from "../useBusy";

describe("useBusy", () => {
  it("処理の間だけ busy を立て、結果をそのまま返す", async () => {
    const { result } = renderHook(() => useBusy());
    let finish: (v: string) => void = () => {};
    let returned: Promise<string> = Promise.resolve("");

    act(() => {
      returned = result.current.runBusy(() => new Promise<string>((r) => (finish = r)));
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      finish("done");
      await returned;
    });
    await expect(returned).resolves.toBe("done");
    expect(result.current.busy).toBe(false);
  });

  it("失敗しても busy を戻し、エラーはそのまま投げる", async () => {
    const { result } = renderHook(() => useBusy());

    await act(async () => {
      await expect(
        result.current.runBusy(() => Promise.reject(new Error("network"))),
      ).rejects.toThrow("network");
    });
    expect(result.current.busy).toBe(false);
  });
});
