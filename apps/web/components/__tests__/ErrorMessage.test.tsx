import { describe, it, expect } from "vitest";
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
