import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminListSection } from "../AdminListSection";

const baseProps = {
  title: "削除済みの団体",
  isLoading: false,
  isError: false,
  loadErrorMessage: "取得に失敗しました",
  actionError: null,
  isEmpty: false,
  emptyMessage: "ありません",
};

describe("AdminListSection", () => {
  it("見出し・説明・一覧を表示する", () => {
    render(
      <AdminListSection {...baseProps} description="説明文">
        <p>行1</p>
      </AdminListSection>,
    );

    expect(screen.getByRole("heading", { name: "削除済みの団体" })).toBeInTheDocument();
    expect(screen.getByText("説明文")).toBeInTheDocument();
    expect(screen.getByText("行1")).toBeInTheDocument();
  });

  it("読み込み中は一覧・空状態を表示しない", () => {
    render(
      <AdminListSection {...baseProps} isLoading isEmpty>
        <p>行1</p>
      </AdminListSection>,
    );

    expect(screen.queryByText("行1")).not.toBeInTheDocument();
    expect(screen.queryByText("ありません")).not.toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージのみ表示する", () => {
    render(
      <AdminListSection {...baseProps} isError>
        <p>行1</p>
      </AdminListSection>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("取得に失敗しました");
    expect(screen.queryByText("行1")).not.toBeInTheDocument();
  });

  it("0件の場合は空状態メッセージを表示する", () => {
    render(
      <AdminListSection {...baseProps} isEmpty>
        {null}
      </AdminListSection>,
    );
    expect(screen.getByText("ありません")).toBeInTheDocument();
  });

  it("操作エラーは一覧と併せて表示する", () => {
    render(
      <AdminListSection {...baseProps} actionError="復元に失敗しました">
        <p>行1</p>
      </AdminListSection>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("復元に失敗しました");
    expect(screen.getByText("行1")).toBeInTheDocument();
  });
});
