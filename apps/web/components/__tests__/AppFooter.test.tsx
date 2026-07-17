import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppFooter } from "../AppFooter";

describe("AppFooter", () => {
  it("ロゴリンク・規約系リンク・コピーライトを表示する", () => {
    render(<AppFooter />);

    expect(screen.getByText("ChoirHub").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("プライバシーポリシー")).toBeInTheDocument();
    expect(screen.getByText("利用規約")).toBeInTheDocument();
    expect(screen.getByText("お問い合わせ")).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });
});
