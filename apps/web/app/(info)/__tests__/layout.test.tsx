import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InfoLayout from "../layout";

describe("InfoLayout", () => {
  it("トップへのロゴリンク・本文・フッターを表示する", () => {
    render(
      <InfoLayout>
        <p>ページ本文</p>
      </InfoLayout>,
    );

    expect(screen.getByRole("banner")).toContainElement(
      screen.getAllByRole("link", { name: "ChoirHub" })[0],
    );
    expect(screen.getAllByRole("link", { name: "ChoirHub" })[0]).toHaveAttribute("href", "/");
    expect(screen.getByText("ページ本文")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
