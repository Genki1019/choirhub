import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionsTab } from "../CollectionsTab";
import type { CollectionSummaryItem } from "@/lib/accounting-api";

function makeCollection(overrides: Partial<CollectionSummaryItem> = {}): CollectionSummaryItem {
  return {
    id: "col-1",
    title: "6/14練習 場所代",
    amount: 300,
    dueDate: null,
    eventId: null,
    yearMonth: "2026-06",
    note: null,
    createdAt: "2026-06-14T00:00:00+09:00",
    summary: { total: 28, paid: 22, pending: 6, waived: 0, paidAmount: 6600 },
    ...overrides,
  };
}

describe("CollectionsTab（表示）", () => {
  it("0件の場合は案内メッセージを表示する", () => {
    render(<CollectionsTab collections={[]} org="o" onAddClick={vi.fn()} />);
    expect(screen.getByText("徴収が登録されていません")).toBeInTheDocument();
  });

  it("タイトル・単価・年月・支払済額・支払状況を表示する", () => {
    render(<CollectionsTab collections={[makeCollection()]} org="o" onAddClick={vi.fn()} />);

    expect(screen.getByText("6/14練習 場所代")).toBeInTheDocument();
    expect(screen.getByText("¥300/人")).toBeInTheDocument();
    expect(screen.getByText("2026-06")).toBeInTheDocument();
    expect(screen.getByText("¥6,600")).toBeInTheDocument();
    expect(screen.getByText("22/28名")).toBeInTheDocument();
    expect(screen.getByText("未6")).toBeInTheDocument();
  });

  it("未払いが0名の場合は未払い件数を表示しない", () => {
    render(
      <CollectionsTab
        collections={[
          makeCollection({
            summary: { total: 28, paid: 28, pending: 0, waived: 0, paidAmount: 8400 },
          }),
        ]}
        org="o"
        onAddClick={vi.fn()}
      />,
    );

    expect(screen.queryByText(/^未\d/)).not.toBeInTheDocument();
  });

  it("詳細へのリンク先が正しい", () => {
    render(
      <CollectionsTab
        collections={[makeCollection()]}
        org="tokyo-men-choir"
        onAddClick={vi.fn()}
      />,
    );

    const link = screen.getByText("6/14練習 場所代").closest("a");
    expect(link).toHaveAttribute("href", "/tokyo-men-choir/accounting/collections/col-1");
  });

  it("「徴収を作成」クリックでonAddClickが呼ばれる", async () => {
    const onAddClick = vi.fn();
    const user = userEvent.setup();
    render(<CollectionsTab collections={[]} org="o" onAddClick={onAddClick} />);

    await user.click(screen.getByText("徴収を作成"));
    expect(onAddClick).toHaveBeenCalled();
  });
});
