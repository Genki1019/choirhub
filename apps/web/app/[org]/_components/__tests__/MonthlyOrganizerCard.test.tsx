import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonthlyOrganizerCard } from "../MonthlyOrganizerCard";

describe("MonthlyOrganizerCard（表示専用）", () => {
  it("organizerが未設定の場合: 「未設定」をグレー文字で表示する", () => {
    render(<MonthlyOrganizerCard organizer={null} />);

    const text = screen.getByText("未設定");
    expect(text).toHaveClass("text-gray-300");
    expect(text).not.toHaveClass("text-brand-500");
  });

  it("organizerが設定済みの場合: パート名をブランドカラーで表示する", () => {
    render(<MonthlyOrganizerCard organizer="Tenor I" />);

    const text = screen.getByText("Tenor I");
    expect(text).toHaveClass("text-brand-500");
    expect(text).not.toHaveClass("text-gray-300");
  });

  it("編集用のボタンは表示しない", () => {
    render(<MonthlyOrganizerCard organizer="Tenor I" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
