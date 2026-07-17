import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RankBadge } from "../RankBadge";

describe("RankBadge", () => {
  it("1位は金メダル絵文字を表示する", () => {
    render(<RankBadge rank={1} />);
    expect(screen.getByText("🥇")).toBeInTheDocument();
  });

  it("2位は銀メダル絵文字を表示する", () => {
    render(<RankBadge rank={2} />);
    expect(screen.getByText("🥈")).toBeInTheDocument();
  });

  it("3位は銅メダル絵文字を表示する", () => {
    render(<RankBadge rank={3} />);
    expect(screen.getByText("🥉")).toBeInTheDocument();
  });

  it("4位以降は数字を表示する", () => {
    render(<RankBadge rank={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
