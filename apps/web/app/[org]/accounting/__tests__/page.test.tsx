import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AccountingPage from "../page";
import {
  accountingApi,
  type FinanceSummary,
  type ExpenseItem,
  type CollectionSummaryItem,
} from "@/lib/accounting-api";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/accounting-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/accounting-api")>("@/lib/accounting-api");
  return {
    ...actual,
    accountingApi: {
      summary: vi.fn(),
      listExpenses: vi.fn(),
      listCollections: vi.fn(),
      deleteExpense: vi.fn(),
    },
  };
});

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      listExpenseCategories: vi.fn().mockResolvedValue([]),
      listMemberTypes: vi.fn().mockResolvedValue([]),
    },
  };
});

function makeSummary(overrides: Partial<FinanceSummary> = {}): FinanceSummary {
  return {
    year: 2026,
    totalExpense: 18000,
    totalCollected: 45000,
    totalPending: 3000,
    balance: 27000,
    expenseByCategory: [],
    ...overrides,
  };
}

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

function makeCollection(overrides: Partial<CollectionSummaryItem> = {}): CollectionSummaryItem {
  return {
    id: "col-1",
    title: "6/14練習 場所代",
    amount: 300,
    dueDate: null,
    eventId: null,
    yearMonth: null,
    note: null,
    createdAt: "2026-06-14T00:00:00+09:00",
    summary: { total: 28, paid: 22, pending: 6, waived: 0, paidAmount: 6600 },
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountingPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(settingsApi.listExpenseCategories).mockResolvedValue([]);
  vi.mocked(settingsApi.listMemberTypes).mockResolvedValue([]);
});

describe("AccountingPage（表示）", () => {
  it("読み込み中はローディング表示をする", () => {
    vi.mocked(accountingApi.summary).mockReturnValue(new Promise(() => {}));
    vi.mocked(accountingApi.listExpenses).mockReturnValue(new Promise(() => {}));
    vi.mocked(accountingApi.listCollections).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("summary取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(accountingApi.summary).mockRejectedValue(new Error("取得に失敗しました"));
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("4つのサマリーカードを表示する", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("¥18,000")).toBeInTheDocument();
    expect(screen.getByText("¥45,000")).toBeInTheDocument();
    expect(screen.getByText("¥3,000")).toBeInTheDocument();
    expect(screen.getByText("¥27,000")).toBeInTheDocument();
  });

  it("残高がマイナスの場合は赤字で表示する", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary({ balance: -5000 }));
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    renderPage();

    const balance = await screen.findByText("-¥5,000");
    expect(balance).toHaveClass("text-red-600");
  });

  it("カテゴリ別支出がある場合は内訳セクションを表示する", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(
      makeSummary({ expenseByCategory: [{ categoryId: "cat-1", name: "会場費", total: 8000 }] }),
    );
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("カテゴリ別支出")).toBeInTheDocument();
    expect(screen.getByText("会場費")).toBeInTheDocument();
  });

  it("カテゴリ別支出が0件の場合は内訳セクションを表示しない", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary({ expenseByCategory: [] }));
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    renderPage();

    await screen.findByText("¥18,000");
    expect(screen.queryByText("カテゴリ別支出")).not.toBeInTheDocument();
  });
});

describe("AccountingPage（年度ナビゲーション）", () => {
  it("「次の年度」クリックで翌年のデータを再取得する", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    const user = userEvent.setup();
    const currentYear = new Date().getFullYear();
    renderPage();

    await screen.findByText("¥18,000");
    expect(screen.getByText(`${currentYear}年度`)).toBeInTheDocument();

    await user.click(screen.getByLabelText("次の年度"));

    expect(screen.getByText(`${currentYear + 1}年度`)).toBeInTheDocument();
    await waitFor(() =>
      expect(accountingApi.summary).toHaveBeenCalledWith("tokyo-men-choir", currentYear + 1),
    );
  });

  it("「前の年度」クリックで前年のデータを再取得する", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    const user = userEvent.setup();
    const currentYear = new Date().getFullYear();
    renderPage();

    await screen.findByText("¥18,000");
    await user.click(screen.getByLabelText("前の年度"));

    expect(screen.getByText(`${currentYear - 1}年度`)).toBeInTheDocument();
  });
});

describe("AccountingPage（タブ切替）", () => {
  it("デフォルトは徴収タブが表示される", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([makeCollection()]);
    renderPage();

    expect(await screen.findByText("6/14練習 場所代")).toBeInTheDocument();
  });

  it("支出タブに切り替えるとExpensesTabが表示される", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([makeExpense()]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("¥18,000");
    await user.click(screen.getByText("支出"));

    expect(await screen.findByText("市民会館 第2練習室")).toBeInTheDocument();
  });
});

describe("AccountingPage（エラー表示・403リダイレクト）", () => {
  it("支出取得が非403エラーの場合はエラーメッセージを表示する（0件と誤認させない）", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockRejectedValue(new Error("支出の取得に失敗しました"));
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("¥18,000");
    await user.click(screen.getByText("支出"));

    expect(await screen.findByText("支出の取得に失敗しました")).toBeInTheDocument();
    expect(screen.queryByText("支出が登録されていません")).not.toBeInTheDocument();
  });

  it("徴収取得が非403エラーの場合はエラーメッセージを表示する（0件と誤認させない）", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockRejectedValue(
      new Error("徴収の取得に失敗しました"),
    );
    renderPage();

    expect(await screen.findByText("徴収の取得に失敗しました")).toBeInTheDocument();
    expect(screen.queryByText("徴収が登録されていません")).not.toBeInTheDocument();
  });

  it("403エラー時は団体トップへリダイレクトする", async () => {
    vi.mocked(accountingApi.summary).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "forbidden", 403),
    );
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/tokyo-men-choir"));
  });
});

describe("AccountingPage（追加・編集操作）", () => {
  it("「徴収を作成」クリックでCollectionModalが開く", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("徴収を作成"));
    expect(screen.getByText("対象年月（任意）")).toBeInTheDocument();
  });

  it("「支出を追加」クリックでExpenseModalが開く", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("¥18,000");
    await user.click(screen.getByText("支出"));
    await user.click(await screen.findByText("支出を追加"));

    expect(screen.getByText("支出を追加", { selector: "h2" })).toBeInTheDocument();
  });

  it("支出の削除ボタンでdeleteExpenseが呼ばれ一覧から消える", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([makeExpense()]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    vi.mocked(accountingApi.deleteExpense).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("¥18,000");
    await user.click(screen.getByText("支出"));
    await user.click(await screen.findByLabelText("市民会館 第2練習室を削除"));

    expect(accountingApi.deleteExpense).toHaveBeenCalledWith("tokyo-men-choir", "exp-1");
    await waitFor(() => expect(screen.queryByText("市民会館 第2練習室")).not.toBeInTheDocument());
  });

  it("支出の削除に失敗した場合はトーストを表示する", async () => {
    vi.mocked(accountingApi.summary).mockResolvedValue(makeSummary());
    vi.mocked(accountingApi.listExpenses).mockResolvedValue([makeExpense()]);
    vi.mocked(accountingApi.listCollections).mockResolvedValue([]);
    vi.mocked(accountingApi.deleteExpense).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("¥18,000");
    await user.click(screen.getByText("支出"));
    await user.click(await screen.findByLabelText("市民会館 第2練習室を削除"));

    expect(await screen.findByText("削除に失敗しました")).toBeInTheDocument();
    expect(screen.getByText("市民会館 第2練習室")).toBeInTheDocument();
  });
});
