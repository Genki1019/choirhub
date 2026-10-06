import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "../ErrorMessage";

describe("ErrorMessage", () => {
  it("メッセージをrole=alertで表示する", () => {
    render(<ErrorMessage>保存に失敗しました</ErrorMessage>);
    expect(screen.getByRole("alert")).toHaveTextContent("保存に失敗しました");
  });

  it.each([null, undefined, ""])("メッセージが空（%s）なら何も表示しない", (message) => {
    const { container } = render(<ErrorMessage>{message}</ErrorMessage>);
    expect(container).toBeEmptyDOMElement();
  });

  it("section表示ではアイコンを添える", () => {
    render(<ErrorMessage variant="section">読み込みに失敗しました</ErrorMessage>);
    const alert = screen.getByRole("alert");
    expect(alert.querySelector("svg")).toBeInTheDocument();
    expect(alert).toHaveTextContent("読み込みに失敗しました");
  });

  it("inline表示ではアイコンを付けない", () => {
    render(<ErrorMessage>保存に失敗しました</ErrorMessage>);
    expect(screen.getByRole("alert").querySelector("svg")).not.toBeInTheDocument();
  });
});

describe("ErrorMessage（画面の外に出たときのスクロール）", () => {
  const scrollIntoView = vi.fn();

  afterEach(() => {
    scrollIntoView.mockReset();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it("メッセージが出たら、見える位置までスクロールする（block: nearest）", () => {
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<ErrorMessage>{null}</ErrorMessage>);
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<ErrorMessage>保存に失敗しました</ErrorMessage>);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("同じメッセージのまま再描画してもスクロールし直さない", () => {
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<ErrorMessage>保存に失敗しました</ErrorMessage>);
    rerender(<ErrorMessage className="mt-2">保存に失敗しました</ErrorMessage>);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("autoScroll={false} ならスクロールしない（裏での取り直しのエラーなど）", () => {
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<ErrorMessage autoScroll={false}>読み込みに失敗しました</ErrorMessage>);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
