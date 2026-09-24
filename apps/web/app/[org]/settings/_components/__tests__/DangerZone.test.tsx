import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DangerZone } from "../DangerZone";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("DangerZone", () => {
  it("30日間の猶予期間を説明し、初期状態では確認モーダルを表示しない", () => {
    render(<DangerZone orgSlug="tokyo-men-choir" orgName="東京男声合唱団" />);

    expect(screen.getByText(/30日以内であれば復元できます/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("「削除」で団体名入りの確認モーダルを開き、キャンセルで閉じる", async () => {
    const user = userEvent.setup();
    render(<DangerZone orgSlug="tokyo-men-choir" orgName="東京男声合唱団" />);

    await user.click(screen.getByRole("button", { name: "削除" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("東京男声合唱団");

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
