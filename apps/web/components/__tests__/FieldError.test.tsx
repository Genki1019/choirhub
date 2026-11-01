import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldError, fieldErrorProps } from "../FieldError";

describe("FieldError", () => {
  it("エラー文を id 付きで表示する", () => {
    render(<FieldError id="name-error">お名前を入力してください</FieldError>);
    const message = screen.getByText("お名前を入力してください");
    expect(message).toHaveAttribute("id", "name-error");
    expect(message).not.toHaveAttribute("role");
  });

  it.each([null, undefined, ""])("エラーが空（%s）なら何も表示しない", (message) => {
    const { container } = render(<FieldError id="name-error">{message}</FieldError>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("fieldErrorProps", () => {
  it("エラーがあれば aria-invalid と、エラー文を指す aria-describedby を返す", () => {
    render(
      <>
        <label htmlFor="name">お名前</label>
        <input id="name" {...fieldErrorProps("name-error", "お名前を入力してください")} />
        <FieldError id="name-error">お名前を入力してください</FieldError>
      </>,
    );
    const input = screen.getByLabelText("お名前");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("お名前を入力してください");
  });

  it("エラーがなければ何も付けない", () => {
    render(<input aria-label="お名前" {...fieldErrorProps("name-error", undefined)} />);
    const input = screen.getByLabelText("お名前");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("invalid に false を渡すと、説明だけを付ける（保存の失敗など入力の誤りでないとき）", () => {
    render(
      <>
        <input
          aria-label="お名前"
          {...fieldErrorProps("name-error", "保存に失敗しました", false)}
        />
        <p id="name-error">保存に失敗しました</p>
      </>,
    );
    const input = screen.getByLabelText("お名前");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("保存に失敗しました");
  });
});
