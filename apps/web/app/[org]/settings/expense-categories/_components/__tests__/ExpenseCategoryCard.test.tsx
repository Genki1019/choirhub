import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseCategoryCard } from "../ExpenseCategoryCard";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { ExpenseCategory } from "@/lib/accounting-api";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      createExpenseCategory: vi.fn(),
      updateExpenseCategory: vi.fn(),
      deleteExpenseCategory: vi.fn(),
    },
  };
});

function makeCats(): ExpenseCategory[] {
  return [
    { id: "cat-1", name: "会場費", sortOrder: 1 },
    { id: "cat-2", name: "楽譜費", sortOrder: 2 },
  ];
}

function renderCard(cats: ExpenseCategory[] = makeCats()) {
  return render(
    <ExpenseCategoryCard
      cats={cats}
      org="o"
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      onCreated={vi.fn()}
      onToast={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ExpenseCategoryCard（表示）", () => {
  it("カテゴリ一覧を表示する", () => {
    renderCard();
    expect(screen.getByText("会場費")).toBeInTheDocument();
    expect(screen.getByText("楽譜費")).toBeInTheDocument();
  });

  it("0件の場合は案内メッセージを表示する", () => {
    renderCard([]);
    expect(screen.getByText("カテゴリがまだありません")).toBeInTheDocument();
  });
});

describe("ExpenseCategoryCard（編集・削除）", () => {
  it("✏️で編集し保存でupdateExpenseCategoryが呼ばれonUpdatedが呼ばれる", async () => {
    vi.mocked(settingsApi.updateExpenseCategory).mockResolvedValue({
      id: "cat-1",
      name: "会場費改",
      sortOrder: 1,
    });
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpenseCategoryCard
        cats={makeCats()}
        org="o"
        onUpdated={onUpdated}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("会場費を編集"));
    const input = screen.getByDisplayValue("会場費");
    await user.clear(input);
    await user.type(input, "会場費改");
    await user.click(screen.getByLabelText("保存"));

    expect(settingsApi.updateExpenseCategory).toHaveBeenCalledWith("o", "cat-1", {
      name: "会場費改",
    });
    expect(onUpdated).toHaveBeenCalledWith({ id: "cat-1", name: "会場費改", sortOrder: 1 });
  });

  it("削除して409エラー時は専用メッセージをトーストする", async () => {
    vi.mocked(settingsApi.deleteExpenseCategory).mockRejectedValue(
      new ApiClientError("CONFLICT", "conflict", 409),
    );
    const onToast = vi.fn();
    const user = userEvent.setup();
    render(
      <ExpenseCategoryCard
        cats={makeCats()}
        org="o"
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
        onToast={onToast}
      />,
    );

    await user.click(screen.getByLabelText("会場費を削除"));

    expect(onToast).toHaveBeenCalledWith("支出記録が紐付いているため削除できません");
  });
});
