import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageMain } from "../PageMain";
import { PageBleedRow } from "../PageBleedRow";

describe("PageMain", () => {
  it("childrenを表示しmax-w-7xlで幅を制限する", () => {
    render(<PageMain>コンテンツ</PageMain>);

    const main = screen.getByText("コンテンツ");
    expect(main.tagName).toBe("MAIN");
    expect(main).toHaveClass("max-w-7xl");
  });

  it("classNameを追加で適用する", () => {
    render(<PageMain className="space-y-4">コンテンツ</PageMain>);
    expect(screen.getByText("コンテンツ")).toHaveClass("space-y-4");
  });
});

describe("PageBleedRow", () => {
  it("childrenを表示しmax-w-7xlで幅を制限する", () => {
    render(<PageBleedRow>行コンテンツ</PageBleedRow>);
    expect(screen.getByText("行コンテンツ")).toHaveClass("max-w-7xl");
  });

  it("classNameを追加で適用する", () => {
    render(<PageBleedRow className="flex items-center">行コンテンツ</PageBleedRow>);
    expect(screen.getByText("行コンテンツ")).toHaveClass("flex", "items-center");
  });
});
