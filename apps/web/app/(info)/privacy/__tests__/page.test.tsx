import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "../page";

describe("PrivacyPage", () => {
  it("主要な条項を表示する", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "プライバシーポリシー" }),
    ).toBeInTheDocument();
    for (const heading of [
      "1. 取得する情報",
      "5. 外部サービスの利用（委託・外国にある第三者）",
      "7. 保存期間と削除",
      "8. 開示・訂正・利用停止等の請求",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("開示等の請求は種類「個人情報」を選択した問い合わせフォームへ誘導する", () => {
    render(<PrivacyPage />);
    const links = screen.getAllByRole("link", { name: "お問い合わせフォーム" });
    expect(links.map((l) => l.getAttribute("href"))).toContain("/contact?category=privacy");
  });

  it("デモ環境への個人情報入力の注意を強調して表示する", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/デモ環境には実在の個人情報を入力しないでください/)).toHaveClass(
      "text-red-700",
    );
  });
});
