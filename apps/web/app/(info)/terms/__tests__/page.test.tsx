import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TermsPage from "../page";

describe("TermsPage", () => {
  it("主要な条項を表示する", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "利用規約" })).toBeInTheDocument();
    for (const heading of [
      "第4条（禁止事項）",
      "第6条（団体の削除とデータの取扱い）",
      "第9条（免責）",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("団体の復元は種類「団体の復元」を選択した問い合わせフォームへ、個人情報はプライバシーポリシーへ誘導する", () => {
    render(<TermsPage />);
    expect(screen.getByRole("link", { name: "お問い合わせ" })).toHaveAttribute(
      "href",
      "/contact?category=org_restore",
    );
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("個人運営・ポートフォリオ兼用で稼働を保証しないことと、デモ環境への個人情報入力の注意を表示する", () => {
    render(<TermsPage />);
    expect(screen.getByText(/開発者のポートフォリオとしても公開しています/)).toBeInTheDocument();
    expect(screen.getByText(/デモ環境には実在の個人情報を入力しないでください/)).toHaveClass(
      "text-red-700",
    );
  });
});
