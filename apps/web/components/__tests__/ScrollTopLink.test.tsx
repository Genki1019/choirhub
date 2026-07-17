import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScrollTopLink } from "../ScrollTopLink";

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe("ScrollTopLink", () => {
  it("指定したhrefとchildrenを表示する", () => {
    render(<ScrollTopLink href="/tokyo-men-choir/schedule">スケジュールへ</ScrollTopLink>);

    const link = screen.getByText("スケジュールへ");
    expect(link.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/schedule");
  });

  it("クリックでwindow.scrollToが最上部にスムーズスクロールで呼ばれる", async () => {
    const user = userEvent.setup();
    render(<ScrollTopLink href="/tokyo-men-choir/schedule">スケジュールへ</ScrollTopLink>);

    await user.click(screen.getByText("スケジュールへ"));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("classNameを適用する", () => {
    render(
      <ScrollTopLink href="/tokyo-men-choir/schedule" className="text-brand-600">
        スケジュールへ
      </ScrollTopLink>,
    );

    expect(screen.getByText("スケジュールへ").closest("a")).toHaveClass("text-brand-600");
  });
});
