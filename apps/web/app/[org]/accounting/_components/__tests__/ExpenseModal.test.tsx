import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseModal } from "../ExpenseModal";
import { accountingApi, type ExpenseCategory, type ExpenseItem } from "@/lib/accounting-api";

vi.mock("@/lib/accounting-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/accounting-api")>("@/lib/accounting-api");
  return {
    ...actual,
    accountingApi: {
      createExpense: vi.fn(),
      updateExpense: vi.fn(),
    },
  };
});

function makeCategories(): ExpenseCategory[] {
  return [
    { id: "cat-1", name: "会場費", sortOrder: 1 },
    { id: "cat-2", name: "楽譜費", sortOrder: 2 },
  ];
}

function makeExpense(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    id: "exp-1",
    category: { id: "cat-2", name: "楽譜費" },
    title: "楽譜「風と光」",
    amount: 2000,
    paymentMethod: "cash",
    paidAt: "2026-05-28T00:00:00+09:00",
    eventId: null,
    note: "備考",
    createdAt: "2026-05-28T00:00:00+09:00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ExpenseModal（新規追加）", () => {
  it("見出しが「支出を追加」になる", () => {
    render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("支出を追加", { selector: "h2" })).toBeInTheDocument();
  });

  it("金額が0以下の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 市民会館 第2練習室 6/14"), "テスト");
    await user.type(screen.getByPlaceholderText("8000"), "0");
    // 数値入力欄はmin=1のHTML5制約でクリック送信がブロックされるため、submitイベントを直接発火してJS側のバリデーションを検証する
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("金額を正の整数で入力してください")).toBeInTheDocument();
  });

  it("入力して追加するとcreateExpenseが呼ばれonSavedがisNew:trueで呼ばれる", async () => {
    const created = makeExpense({ id: "exp-new" });
    vi.mocked(accountingApi.createExpense).mockResolvedValue(created);
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={null}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 市民会館 第2練習室 6/14"), "楽譜「風と光」");
    await user.type(screen.getByPlaceholderText("8000"), "2000");
    await user.click(screen.getByText("追加する"));

    expect(accountingApi.createExpense).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({ categoryId: "cat-1", title: "楽譜「風と光」", amount: 2000 }),
    );
    expect(onSaved).toHaveBeenCalledWith(created, true);
  });

  it("保存に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(accountingApi.createExpense).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 市民会館 第2練習室 6/14"), "テスト");
    await user.type(screen.getByPlaceholderText("8000"), "1000");
    await user.click(screen.getByText("追加する"));

    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
  });

  it("キャンセル・×ボタンでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={null}
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("ExpenseModal（編集）", () => {
  it("見出しが「支出を編集」になり既存値が初期値として入る", () => {
    render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={makeExpense()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText("支出を編集", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("楽譜「風と光」")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("備考")).toBeInTheDocument();
  });

  it("更新するとupdateExpenseが呼ばれonSavedがisNew:falseで呼ばれる", async () => {
    const updated = makeExpense({ title: "楽譜「風と光」改" });
    vi.mocked(accountingApi.updateExpense).mockResolvedValue(updated);
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={makeExpense()}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByText("更新する"));

    expect(accountingApi.updateExpense).toHaveBeenCalledWith(
      "o",
      "exp-1",
      expect.objectContaining({ title: "楽譜「風と光」" }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated, false);
  });
});
