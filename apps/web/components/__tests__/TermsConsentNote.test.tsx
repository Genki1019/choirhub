import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TermsConsentNote } from "../TermsConsentNote";

describe("TermsConsentNote", () => {
  it("操作名を含む同意文と、利用規約・プライバシーポリシーへのリンクを表示する", () => {
    render(<TermsConsentNote action="登録" />);

    expect(screen.getByText(/登録することで/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
