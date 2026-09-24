import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppFooter } from "../AppFooter";

describe("AppFooter", () => {
  it("ロゴリンク・規約系リンク・コピーライトを表示する", () => {
    render(<AppFooter />);

    expect(screen.getByText("ChoirHub").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("プライバシーポリシー").closest("a")).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByText("利用規約").closest("a")).toHaveAttribute("href", "/terms");
    expect(screen.getByText("お問い合わせ").closest("a")).toHaveAttribute("href", "/contact");
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });
});
