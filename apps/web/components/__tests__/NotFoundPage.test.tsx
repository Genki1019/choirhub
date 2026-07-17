import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotFoundPage } from "../NotFoundPage";

const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
}));

describe("NotFoundPage", () => {
  it("デフォルトメッセージを表示する", () => {
    render(<NotFoundPage />);
    expect(screen.getByText("ページが見つかりません")).toBeInTheDocument();
  });

  it("カスタムメッセージを表示する", () => {
    render(<NotFoundPage message="このページにアクセスする権限がありません" />);
    expect(screen.getByText("このページにアクセスする権限がありません")).toBeInTheDocument();
  });

  it("「前のページに戻る」クリックでrouter.back()が呼ばれる", async () => {
    const user = userEvent.setup();
    render(<NotFoundPage />);

    await user.click(screen.getByText("前のページに戻る"));
    expect(back).toHaveBeenCalled();
  });
});
