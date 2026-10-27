import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseCategoryCard } from "../ExpenseCategoryCard";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { ExpenseCategory } from "@/lib/accounting-api";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

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

function renderCard(
  cats: ExpenseCategory[] = makeCats(),
  overrides: Partial<Record<string, unknown>> = {},
) {
  return render(
    <ExpenseCategoryCard
      cats={cats}
      org="o"
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      onCreated={vi.fn()}
      onReordered={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPointerCapture();
});

describe("ExpenseCategoryCard（表示）", () => {
  it("同じ名前で追加すると、409の理由をカードの中に読み上げ、もう一度追加を始めると消える", async () => {
    vi.mocked(settingsApi.createExpenseCategory)
      .mockRejectedValueOnce(
        new ApiClientError("CONFLICT", "同じ名前のカテゴリがすでにあります", 409),
      )
      .mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("カテゴリ名を入力"), "合宿費");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "同じ名前のカテゴリがすでにあります",
    );

    await user.click(addButtons[addButtons.length - 1]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("追加の失敗が5xxなら代わりの文言を出す", async () => {
    vi.mocked(settingsApi.createExpenseCategory).mockRejectedValue(
      new ApiClientError("UNKNOWN", "", 500),
    );
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("カテゴリ名を入力"), "合宿費");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "カテゴリの追加に失敗しました。もう一度お試しください。",
    );
  });

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
        onReordered={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("会場費を編集"));
    const input = screen.getByDisplayValue("会場費");
    await user.clear(input);
    await user.type(input, "会場費改");
    await user.click(screen.getByRole("button", { name: "カテゴリ名を保存" }));

    expect(settingsApi.updateExpenseCategory).toHaveBeenCalledWith("o", "cat-1", {
      name: "会場費改",
    });
    expect(onUpdated).toHaveBeenCalledWith({ id: "cat-1", name: "会場費改", sortOrder: 1 });
  });

  it("名前の保存に失敗したら入力欄の下に理由を出し、ほかの場所には出さない", async () => {
    vi.mocked(settingsApi.updateExpenseCategory).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const user = userEvent.setup();
    render(
      <ExpenseCategoryCard
        cats={makeCats()}
        org="o"
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
        onReordered={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("会場費を編集"));
    await user.type(screen.getByRole("textbox", { name: "カテゴリ名" }), "改{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "カテゴリ名の保存に失敗しました。もう一度お試しください。",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("削除して409エラー時はAPIの理由を確認ダイアログの中に表示する", async () => {
    vi.mocked(settingsApi.deleteExpenseCategory).mockRejectedValue(
      new ApiClientError("CONFLICT", "支出記録が紐付いているため削除できません", 409),
    );
    const user = userEvent.setup();
    render(
      <ExpenseCategoryCard
        cats={makeCats()}
        org="o"
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
        onReordered={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("会場費を削除"));
    await user.click(
      within(screen.getByRole("alertdialog", { name: "支出の区分を削除しますか？" })).getByRole(
        "button",
        {
          name: "削除する",
        },
      ),
    );

    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "支出記録が紐付いているため削除できません",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });
});

describe("ExpenseCategoryCard（並び替え）", () => {
  it("ドラッグで並び替えるとupdateExpenseCategoryが変更された2件だけ呼ばれる", async () => {
    vi.mocked(settingsApi.updateExpenseCategory).mockResolvedValue(makeCats()[0]);
    renderCard();

    dragAndDrop(
      screen.getByLabelText("楽譜費をドラッグして並び替え"),
      screen.getByLabelText("会場費をドラッグして並び替え"),
    );

    expect(settingsApi.updateExpenseCategory).toHaveBeenCalledWith("o", "cat-2", {
      sortOrder: 1,
    });
    expect(settingsApi.updateExpenseCategory).toHaveBeenCalledWith("o", "cat-1", {
      sortOrder: 2,
    });
  });

  it("並び替えに失敗したら元の順序にロールバックし、理由を読み上げる", async () => {
    vi.mocked(settingsApi.updateExpenseCategory).mockRejectedValue(new Error("network error"));
    renderCard(makeCats());

    dragAndDrop(
      screen.getByLabelText("楽譜費をドラッグして並び替え"),
      screen.getByLabelText("会場費をドラッグして並び替え"),
    );

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "並び替えに失敗しました。もう一度お試しください。",
      );
    });
  });
});
