import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseModal } from "../ExpenseModal";
import { accountingApi, type ExpenseCategory, type ExpenseItem } from "@/lib/accounting-api";
import { ApiClientError } from "@/lib/api-client";

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
    paidAt: "2026-05-28T00:00:00.000Z",
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
    await user.type(screen.getByPlaceholderText("8000"), "0");
    // 数値入力欄はmin=1のHTML5制約でクリック送信がブロックされるため、submitイベントを直接発火してJS側のバリデーションを検証する
    fireEvent.submit(document.querySelector("form")!);

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
    fireEvent.change(screen.getByLabelText("支払日"), { target: { value: "2026-06-14" } });
    await user.click(screen.getByText("追加する"));

    expect(accountingApi.createExpense).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({
        categoryId: "cat-1",
        title: "楽譜「風と光」",
        amount: 2000,
        paidAt: "2026-06-14",
      }),
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "支出の保存に失敗しました。もう一度お試しください。",
    );
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
      expect.objectContaining({ title: "楽譜「風と光」", paidAt: "2026-05-28" }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated, false);
  });
});

describe("ExpenseModal（共通モーダル）", () => {
  const renderAdd = (onClose = vi.fn()) =>
    render(
      <ExpenseModal
        org="o"
        categories={makeCategories()}
        editing={null}
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );

  it("見出しを名前に持つダイアログで開き、カテゴリ欄にフォーカスが入る", () => {
    renderAdd();

    expect(screen.getByRole("dialog", { name: "支出を追加" })).toBeInTheDocument();
    expect(screen.getByLabelText("カテゴリ")).toHaveFocus();
  });

  it("Esc で閉じる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderAdd(onClose);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("保存中は Esc・キャンセルで閉じない", async () => {
    vi.mocked(accountingApi.createExpense).mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderAdd(onClose);

    await user.type(screen.getByLabelText("件名"), "テスト");
    await user.type(screen.getByLabelText("金額（円）"), "500{Enter}");
    await user.keyboard("{Escape}");

    expect(accountingApi.createExpense).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("4xx の失敗は API の理由を出し、入力を残す", async () => {
    vi.mocked(accountingApi.createExpense).mockRejectedValue(
      new ApiClientError("NOT_FOUND", "カテゴリが見つかりません", 404),
    );
    const user = userEvent.setup();
    renderAdd();

    await user.type(screen.getByLabelText("件名"), "テスト");
    await user.type(screen.getByLabelText("金額（円）"), "500{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("カテゴリが見つかりません");
    expect(screen.getByLabelText("件名")).toHaveValue("テスト");
  });
});

describe("ExpenseModal（カテゴリの読み込みが後から終わる）", () => {
  it("開いた後にカテゴリが届いても、表示中の先頭のカテゴリで保存できる", async () => {
    vi.mocked(accountingApi.createExpense).mockResolvedValue(makeExpense());
    const user = userEvent.setup();
    const props = { org: "o", editing: null, onClose: vi.fn(), onSaved: vi.fn() };
    const { rerender } = render(<ExpenseModal {...props} categories={[]} />);
    rerender(<ExpenseModal {...props} categories={makeCategories()} />);

    expect(screen.getByLabelText("カテゴリ")).toHaveValue("cat-1");
    await user.type(screen.getByLabelText("件名"), "練習室");
    await user.type(screen.getByLabelText("金額（円）"), "800{Enter}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(accountingApi.createExpense).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({ categoryId: "cat-1" }),
    );
  });
});
