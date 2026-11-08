import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("アイコンを 32px の飾りとして、見出しと一緒に表示する", () => {
    const { container } = render(<EmptyState icon={Users} title="メンバーがいません" />);

    expect(screen.getByText("メンバーがいません")).toBeInTheDocument();
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("width", "32");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("説明とボタンを渡さなければ表示しない", () => {
    render(<EmptyState icon={Users} title="メンバーがいません" />);

    expect(screen.getAllByText(/./)).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("説明とボタンを渡すと表示し、ボタンを押せる", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Users}
        title="メンバーがいません"
        description="「メンバーを招待」から追加してください"
        action={
          <button type="button" onClick={onClick}>
            メンバーを招待
          </button>
        }
      />,
    );

    expect(screen.getByText("「メンバーを招待」から追加してください")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "メンバーを招待" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
