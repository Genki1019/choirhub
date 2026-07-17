import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpensesTab } from "../ExpensesTab";
import type { ExpenseItem } from "@/lib/accounting-api";

function makeExpense(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    id: "exp-1",
    category: { id: "cat-1", name: "会場費" },
    title: "市民会館 第2練習室",
    amount: 8000,
    paymentMethod: "bank_transfer",
    paidAt: "2026-06-14T00:00:00+09:00",
    eventId: null,
    note: null,
    createdAt: "2026-06-14T00:00:00+09:00",
    ...overrides,
  };
}

describe("ExpensesTab（表示）", () => {
  it("0件の場合は案内メッセージを表示する", () => {
    render(
      <ExpensesTab
        expenses={[]}
        deletingId={null}
        onAddClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );
    expect(screen.getByText("支出が登録されていません")).toBeInTheDocument();
  });

  it("カテゴリ・件名・金額・支払方法・日付を表示する", () => {
    render(
      <ExpensesTab
        expenses={[makeExpense()]}
        deletingId={null}
        onAddClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(screen.getByText("会場費")).toBeInTheDocument();
    expect(screen.getByText("市民会館 第2練習室")).toBeInTheDocument();
    expect(screen.getByText("¥8,000")).toBeInTheDocument();
    expect(screen.getByText("振込")).toBeInTheDocument();
    expect(screen.getByText("2026/06/14")).toBeInTheDocument();
  });

  it("支払方法が未設定の場合は表示しない", () => {
    render(
      <ExpensesTab
        expenses={[makeExpense({ paymentMethod: null })]}
        deletingId={null}
        onAddClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(screen.queryByText("振込")).not.toBeInTheDocument();
  });
});

describe("ExpensesTab（操作）", () => {
  it("✏️クリックでonEditClickが呼ばれる", async () => {
    const onEditClick = vi.fn();
    const user = userEvent.setup();
    const expense = makeExpense();
    render(
      <ExpensesTab
        expenses={[expense]}
        deletingId={null}
        onAddClick={vi.fn()}
        onEditClick={onEditClick}
        onDeleteClick={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("市民会館 第2練習室を編集"));
    expect(onEditClick).toHaveBeenCalledWith(expense);
  });

  it("🗑️クリックでonDeleteClickが呼ばれる", async () => {
    const onDeleteClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpensesTab
        expenses={[makeExpense()]}
        deletingId={null}
        onAddClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeleteClick={onDeleteClick}
      />,
    );

    await user.click(screen.getByLabelText("市民会館 第2練習室を削除"));
    expect(onDeleteClick).toHaveBeenCalledWith("exp-1");
  });

  it("削除処理中はスピナーを表示し削除ボタンが無効化される", () => {
    render(
      <ExpensesTab
        expenses={[makeExpense()]}
        deletingId="exp-1"
        onAddClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("市民会館 第2練習室を削除")).toBeDisabled();
  });

  it("「支出を追加」クリックでonAddClickが呼ばれる", async () => {
    const onAddClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpensesTab
        expenses={[]}
        deletingId={null}
        onAddClick={onAddClick}
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    await user.click(screen.getByText("支出を追加"));
    expect(onAddClick).toHaveBeenCalled();
  });
});
