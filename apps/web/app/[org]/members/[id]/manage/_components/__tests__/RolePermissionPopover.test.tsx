import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RolePermissionPopover } from "../RolePermissionPopover";

const roles = [
  { value: "tech", label: "技術系", description: "選曲・スケジュール・ステージ構成" },
  { value: "score", label: "楽譜がかり", description: "楽譜管理・アップロード" },
];

describe("RolePermissionPopover", () => {
  it("初期状態では権限説明が表示されない", () => {
    render(<RolePermissionPopover roles={roles} />);
    expect(screen.queryByText("選曲・スケジュール・ステージ構成")).not.toBeInTheDocument();
  });

  it("ホバーすると全ロールの権限説明が表示される", async () => {
    const user = userEvent.setup();
    render(<RolePermissionPopover roles={roles} />);

    await user.hover(screen.getByRole("button", { name: "ロールの権限を表示" }));
    expect(screen.getByText("選曲・スケジュール・ステージ構成")).toBeInTheDocument();
    expect(screen.getByText("楽譜管理・アップロード")).toBeInTheDocument();
  });

  it("クリックすると開いたままになり、Escapeで閉じる", async () => {
    const user = userEvent.setup();
    render(<RolePermissionPopover roles={roles} />);

    await user.click(screen.getByRole("button", { name: "ロールの権限を表示" }));
    expect(screen.getByText("選曲・スケジュール・ステージ構成")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("選曲・スケジュール・ステージ構成")).not.toBeInTheDocument();
    });
  });
});
