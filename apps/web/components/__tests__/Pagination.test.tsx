import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "../Pagination";

describe("Pagination", () => {
  it("総ページ数が1以下の場合は何も描画しない", () => {
    const { container } = render(
      <Pagination meta={{ total: 5, page: 1, perPage: 20 }} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("件数とページ数を表示する", () => {
    render(<Pagination meta={{ total: 45, page: 2, perPage: 20 }} onPageChange={vi.fn()} />);
    expect(screen.getByText("21–40 / 45件")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("最初のページでは「前のページ」ボタンが無効", () => {
    render(<Pagination meta={{ total: 45, page: 1, perPage: 20 }} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText("前のページ")).toBeDisabled();
    expect(screen.getByLabelText("次のページ")).toBeEnabled();
  });

  it("最後のページでは「次のページ」ボタンが無効", () => {
    render(<Pagination meta={{ total: 45, page: 3, perPage: 20 }} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText("次のページ")).toBeDisabled();
    expect(screen.getByLabelText("前のページ")).toBeEnabled();
  });

  it("「次のページ」クリックでonPageChangeがpage+1で呼ばれる", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination meta={{ total: 45, page: 1, perPage: 20 }} onPageChange={onPageChange} />);
    await user.click(screen.getByLabelText("次のページ"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("「前のページ」クリックでonPageChangeがpage-1で呼ばれる", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination meta={{ total: 45, page: 2, perPage: 20 }} onPageChange={onPageChange} />);
    await user.click(screen.getByLabelText("前のページ"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
