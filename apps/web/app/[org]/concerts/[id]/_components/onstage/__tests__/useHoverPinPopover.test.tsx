import { describe, it, expect } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { useHoverPinPopover } from "../useHoverPinPopover";

function sleep(ms: number) {
  return act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}

function TestHost() {
  const containerRef = useRef<HTMLDivElement>(null);
  const popover = useHoverPinPopover(containerRef);
  return (
    <div>
      <div ref={containerRef} {...popover.containerProps}>
        <button {...popover.triggerProps}>トリガー</button>
        {popover.isOpen && <div>ポップオーバー本体</div>}
      </div>
      <button onClick={popover.close}>外部クローズボタン</button>
      <div>外側</div>
    </div>
  );
}

describe("useHoverPinPopover", () => {
  it("初期状態は閉じている", () => {
    render(<TestHost />);
    expect(screen.queryByText("ポップオーバー本体")).not.toBeInTheDocument();
  });

  it("マウスホバーで開く", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    await user.hover(screen.getByText("トリガー"));
    expect(screen.getByText("ポップオーバー本体")).toBeInTheDocument();
  });

  it("ホバー後、マウスを離すと200ms後に閉じる", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    await user.hover(screen.getByText("トリガー"));
    await user.unhover(screen.getByText("トリガー"));
    expect(screen.getByText("ポップオーバー本体")).toBeInTheDocument();

    await sleep(250);
    await waitFor(() => {
      expect(screen.queryByText("ポップオーバー本体")).not.toBeInTheDocument();
    });
  }, 10000);

  it("トリガークリックでpinned状態になり、マウスを離しても閉じない", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    await user.click(screen.getByText("トリガー"));
    await user.unhover(screen.getByText("トリガー"));
    await sleep(250);

    expect(screen.getByText("ポップオーバー本体")).toBeInTheDocument();
  }, 10000);

  it("外側クリックで閉じる", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    await user.click(screen.getByText("トリガー"));
    expect(screen.getByText("ポップオーバー本体")).toBeInTheDocument();

    await user.click(screen.getByText("外側"));
    expect(screen.queryByText("ポップオーバー本体")).not.toBeInTheDocument();
  });

  it("close()呼び出しで即座に閉じる", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    await user.click(screen.getByText("トリガー"));
    await user.click(screen.getByText("外部クローズボタン"));

    expect(screen.queryByText("ポップオーバー本体")).not.toBeInTheDocument();
  });
});
