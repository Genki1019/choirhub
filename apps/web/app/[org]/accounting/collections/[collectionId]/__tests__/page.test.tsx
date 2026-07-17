import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CollectionDetailPage from "../page";
import {
  accountingApi,
  type CollectionDetail,
  type CollectionPaymentItem,
} from "@/lib/accounting-api";
import { ApiClientError } from "@/lib/api-client";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", collectionId: "col-1" }),
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/accounting-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/accounting-api")>("@/lib/accounting-api");
  return {
    ...actual,
    accountingApi: {
      getCollection: vi.fn(),
      recordPayment: vi.fn(),
      bulkRecordPayment: vi.fn(),
    },
  };
});

function makePayment(overrides: Partial<CollectionPaymentItem> = {}): CollectionPaymentItem {
  return {
    id: "pay-1",
    member: {
      id: "member-1",
      nameJa: "山田太郎",
      part: { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 1 },
      memberTypeFee: null,
    },
    status: "pending",
    amount: null,
    paidAt: null,
    method: null,
    note: null,
    ...overrides,
  };
}

function makeCollection(overrides: Partial<CollectionDetail> = {}): CollectionDetail {
  return {
    id: "col-1",
    title: "6/14練習 場所代",
    amount: 300,
    dueDate: null,
    eventId: null,
    yearMonth: null,
    note: null,
    createdAt: "2026-06-14T00:00:00+09:00",
    payments: [makePayment()],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CollectionDetailPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CollectionDetailPage（表示）", () => {
  it("読み込み中はローディング表示をする", () => {
    vi.mocked(accountingApi.getCollection).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("取得エラー時（403以外）はエラーメッセージを表示する", async () => {
    vi.mocked(accountingApi.getCollection).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("403エラー時は団体トップへリダイレクトする", async () => {
    vi.mocked(accountingApi.getCollection).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "forbidden", 403),
    );
    renderPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/tokyo-men-choir"));
  });

  it("タイトル・単価・4つのサマリーカードを表示する", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(
      makeCollection({
        payments: [
          makePayment({ id: "pay-1", status: "paid", amount: 300 }),
          makePayment({
            id: "pay-2",
            status: "pending",
            member: { ...makePayment().member, id: "m2", nameJa: "鈴木花子" },
          }),
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("6/14練習 場所代")).toBeInTheDocument();
    expect(screen.getByText("¥300/人")).toBeInTheDocument();
    expect(screen.getByText("対象人数")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0); // 対象人数
    expect(screen.getByText("徴収済額")).toBeInTheDocument();
    expect(screen.getAllByText("¥300").length).toBeGreaterThan(0); // 徴収済額・行内金額
  });

  it("パートごとにグルーピングして表示する", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(
      makeCollection({
        payments: [
          makePayment({ id: "pay-1", member: { ...makePayment().member, nameJa: "山田太郎" } }),
          makePayment({
            id: "pay-2",
            member: {
              id: "m2",
              nameJa: "鈴木花子",
              part: { id: "part-2", name: "ベース", voiceType: "bass", sortOrder: 4 },
              memberTypeFee: null,
            },
          }),
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("テノール1")).toBeInTheDocument();
    expect(screen.getByText("ベース")).toBeInTheDocument();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("鈴木花子")).toBeInTheDocument();
  });

  it("パート未設定の場合は「パートなし」にまとめられる", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(
      makeCollection({
        payments: [makePayment({ member: { ...makePayment().member, part: null } })],
      }),
    );
    renderPage();

    expect(await screen.findByText("パートなし")).toBeInTheDocument();
  });
});

describe("CollectionDetailPage（支払い操作）", () => {
  it("「支払済」クリックでrecordPaymentが現金・今日で呼ばれる", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(makeCollection());
    vi.mocked(accountingApi.recordPayment).mockResolvedValue(
      makePayment({ status: "paid", amount: 300, method: "cash" }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("山田太郎を支払済みにする"));

    expect(accountingApi.recordPayment).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "col-1",
      "member-1",
      expect.objectContaining({ status: "paid", method: "cash" }),
    );
    expect(await screen.findByText("山田太郎 の支払いを記録しました")).toBeInTheDocument();

    // 会計トップ・徴収一覧のキャッシュも無効化され、詳細クエリが再取得されることを確認する
    await waitFor(() => expect(accountingApi.getCollection).toHaveBeenCalledTimes(2));
  });

  it("編集モーダルで保存すると会計トップ・徴収一覧のキャッシュも無効化される", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(makeCollection());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("山田太郎を編集"));
    await user.click(screen.getByText("保存する"));

    await waitFor(() => expect(accountingApi.getCollection).toHaveBeenCalledTimes(2));
  });

  it("未払いを全選択→一括現金支払済みでbulkRecordPaymentが呼ばれる", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(
      makeCollection({
        payments: [
          makePayment({
            id: "pay-1",
            member: { ...makePayment().member, id: "m1", nameJa: "山田太郎" },
          }),
          makePayment({
            id: "pay-2",
            member: { ...makePayment().member, id: "m2", nameJa: "鈴木花子" },
          }),
        ],
      }),
    );
    vi.mocked(accountingApi.bulkRecordPayment).mockResolvedValue({ updated: 2 });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("山田太郎");
    await user.click(screen.getByText("未払いを全選択"));
    expect(screen.getByText("2名選択中")).toBeInTheDocument();

    await user.click(screen.getByText("一括現金支払済み"));

    expect(accountingApi.bulkRecordPayment).toHaveBeenCalledWith(
      "tokyo-men-choir",
      "col-1",
      expect.objectContaining({ memberIds: expect.arrayContaining(["m1", "m2"]), status: "paid" }),
    );
  });

  it("選択解除ボタンで選択がクリアされる", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(makeCollection());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("山田太郎を選択"));
    expect(screen.getByText("1名選択中")).toBeInTheDocument();

    await user.click(screen.getByLabelText("選択解除"));
    expect(screen.queryByText("1名選択中")).not.toBeInTheDocument();
  });

  it("「編集」クリックでRecordModalが開く", async () => {
    vi.mocked(accountingApi.getCollection).mockResolvedValue(makeCollection());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText("山田太郎を編集"));
    expect(screen.getByText("支払い記録")).toBeInTheDocument();
  });
});
