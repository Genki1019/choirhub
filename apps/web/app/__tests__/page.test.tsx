import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import RootPage from "../page";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

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
