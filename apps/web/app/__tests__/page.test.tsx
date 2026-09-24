import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import RootPage from "../page";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

describe("RootPage（団体作成申請への導線）", () => {
  it("ヘッダー・ヒーロー・CTAの3箇所から/applyへリンクする", async () => {
    render(await RootPage());

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "団体作成を申請" })).toHaveAttribute(
      "href",
      "/apply",
    );
    const applyLinks = screen.getAllByRole("link", { name: "団体作成を申請する" });
    expect(applyLinks).toHaveLength(2);
    applyLinks.forEach((link) => expect(link).toHaveAttribute("href", "/apply"));
  });
});

describe("RootPage（フッター）", () => {
  it("プライバシーポリシー・利用規約・お問い合わせへのリンクを表示する", async () => {
    render(await RootPage());

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(within(footer).getByRole("link", { name: "利用規約" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(within(footer).getByRole("link", { name: "お問い合わせ" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });
});
