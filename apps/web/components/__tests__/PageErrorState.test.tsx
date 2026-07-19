import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageErrorState } from "../PageErrorState";

describe("PageErrorState", () => {
  it("タイトル・戻るリンク・エラーメッセージを表示する", () => {
    render(
      <PageErrorState
        title="イベントを追加"
        backHref="/tokyo-men-choir/schedule"
        message="読み込みに失敗しました"
      />,
    );
    expect(screen.getByRole("heading", { name: "イベントを追加" })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tokyo-men-choir/schedule");
    expect(screen.getByText("読み込みに失敗しました")).toBeInTheDocument();
  });
});
