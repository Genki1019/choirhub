import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExpenseCategoriesPage from "../page";
import { settingsApi } from "@/lib/settings-api";
import type { ExpenseCategory } from "@/lib/accounting-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      listExpenseCategories: vi.fn(),
      createExpenseCategory: vi.fn(),
    },
  };
});

function makeCats(): ExpenseCategory[] {
  return [
    { id: "cat-1", name: "会場費", sortOrder: 1 },
    { id: "cat-2", name: "楽譜費", sortOrder: 2 },
  ];
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExpenseCategoriesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ExpenseCategoriesPage", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(settingsApi.listExpenseCategories).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("カテゴリ一覧を表示する", async () => {
    vi.mocked(settingsApi.listExpenseCategories).mockResolvedValue(makeCats());
    renderPage();

    expect(await screen.findByText("会場費")).toBeInTheDocument();
    expect(screen.getByText("楽譜費")).toBeInTheDocument();
  });

  it("追加するとonCreatedで一覧に反映される", async () => {
    vi.mocked(settingsApi.listExpenseCategories).mockResolvedValue(makeCats());
    vi.mocked(settingsApi.createExpenseCategory).mockResolvedValue({
      id: "cat-3",
      name: "交通費",
      sortOrder: 3,
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("会場費");
    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("カテゴリ名を入力"), "交通費");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);

    expect(await screen.findByText("交通費")).toBeInTheDocument();
  });
});
