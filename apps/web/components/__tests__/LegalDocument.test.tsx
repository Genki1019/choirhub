import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalDocument, LegalSection, LegalWarning } from "../LegalDocument";

describe("LegalDocument", () => {
  it("タイトル・各条項・制定日を表示する", () => {
    render(
      <LegalDocument title="利用規約" establishedOn="2026年9月24日">
        <LegalSection title="第1条（定義）">
          <p>本文</p>
        </LegalSection>
      </LegalDocument>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "利用規約" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "第1条（定義）" })).toBeInTheDocument();
    expect(screen.getByText("本文")).toBeInTheDocument();
    expect(screen.getByText("制定日: 2026年9月24日")).toBeInTheDocument();
  });

  it("LegalWarningは強調された注意書きとして表示する", () => {
    render(<LegalWarning>個人情報を入力しないでください</LegalWarning>);
    expect(screen.getByText("個人情報を入力しないでください")).toHaveClass("text-red-700");
  });
});
