import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InquiriesSection } from "../InquiriesSection";
import { inquiriesApi, type Inquiry } from "@/lib/inquiries-api";

vi.mock("@/lib/inquiries-api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/inquiries-api")>("@/lib/inquiries-api")),
  inquiriesApi: { listOpen: vi.fn(), resolve: vi.fn() },
}));

const inquiry: Inquiry = {
  id: "inq-1",
  category: "org_restore",
  name: "山田 太郎",
  email: "yamada@example.com",
  orgName: "東京男声合唱団",
  message: "誤って団体を削除しました。\n復元をお願いします。",
  status: "open",
  resolvedByEmail: null,
  resolvedAt: null,
  createdAt: "2026-09-24T00:00:00.000Z",
};

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InquiriesSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InquiriesSection", () => {
  it("未対応がない場合は空状態を表示する", async () => {
    vi.mocked(inquiriesApi.listOpen).mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("未対応のお問い合わせはありません")).toBeInTheDocument();
  });

  it("種類・送信者・団体名・本文を表示する", async () => {
    vi.mocked(inquiriesApi.listOpen).mockResolvedValue([inquiry]);
    renderSection();

    expect(await screen.findByText(/削除した団体の復元/)).toBeInTheDocument();
    expect(screen.getByText("山田 太郎（yamada@example.com）")).toBeInTheDocument();
    expect(screen.getByText("団体名: 東京男声合唱団")).toBeInTheDocument();
    expect(screen.getByText(/復元をお願いします。/)).toBeInTheDocument();
  });

  it("団体名が未入力の場合は団体名行を表示しない", async () => {
    vi.mocked(inquiriesApi.listOpen).mockResolvedValue([{ ...inquiry, orgName: null }]);
    renderSection();

    await screen.findByText("山田 太郎（yamada@example.com）");
    expect(screen.queryByText(/団体名:/)).not.toBeInTheDocument();
  });

  it("対応済みボタンでAPIを呼び、一覧から取り除く", async () => {
    vi.mocked(inquiriesApi.listOpen).mockResolvedValue([inquiry]);
    vi.mocked(inquiriesApi.resolve).mockResolvedValue({ ...inquiry, status: "resolved" });
    const user = userEvent.setup();
    renderSection();

    await user.click(
      await screen.findByRole("button", { name: "山田 太郎さんのお問い合わせを対応済みにする" }),
    );

    expect(inquiriesApi.resolve).toHaveBeenCalledWith("inq-1");
    expect(await screen.findByText("未対応のお問い合わせはありません")).toBeInTheDocument();
  });

  it("更新に失敗した場合はエラーを表示し、一覧に残す", async () => {
    vi.mocked(inquiriesApi.listOpen).mockResolvedValue([inquiry]);
    vi.mocked(inquiriesApi.resolve).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    renderSection();

    await user.click(
      await screen.findByRole("button", { name: "山田 太郎さんのお問い合わせを対応済みにする" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("更新に失敗しました");
    expect(screen.getByText("山田 太郎（yamada@example.com）")).toBeInTheDocument();
  });

  it("一覧の取得に失敗した場合はエラーを表示する", async () => {
    vi.mocked(inquiriesApi.listOpen).mockRejectedValue(new Error("failed"));
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent("お問い合わせの取得に失敗しました");
  });
});
