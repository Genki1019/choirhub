import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ContactPage from "../page";

async function renderPage(searchParams: Record<string, string>) {
  render(await ContactPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("ContactPage", () => {
  it("見出しとフォームを表示する", async () => {
    await renderPage({});
    expect(screen.getByRole("heading", { name: "お問い合わせ" })).toBeInTheDocument();
    expect(screen.getByLabelText("お問い合わせの種類")).toHaveValue("other");
  });

  it("?category=org_restore で種類を初期選択する", async () => {
    await renderPage({ category: "org_restore" });
    expect(screen.getByLabelText("お問い合わせの種類")).toHaveValue("org_restore");
  });

  it("不正なcategoryは無視して既定値にする", async () => {
    await renderPage({ category: "unknown" });
    expect(screen.getByLabelText("お問い合わせの種類")).toHaveValue("other");
  });
});
