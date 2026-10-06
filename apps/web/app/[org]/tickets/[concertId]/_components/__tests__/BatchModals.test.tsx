import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateBatchModal } from "../CreateBatchModal";
import { EditBatchModal } from "../EditBatchModal";
import { ticketsApi, type BatchDetail } from "@/lib/tickets-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      createBatch: vi.fn(),
      updateBatch: vi.fn(),
      deleteBatch: vi.fn(),
    },
  };
});

function makeBatch(overrides: Partial<BatchDetail> = {}): BatchDetail {
  return {
    id: "batch-1",
    name: "一般",
    price: 2000,
    priceStudent: 1000,
    totalCount: 100,
    saleStart: null,
    saleEnd: null,
    allocations: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CreateBatchModal", () => {
  it("送信するとcreateBatchが正しいペイロードで呼ばれonCreatedが呼ばれる", async () => {
    vi.mocked(ticketsApi.createBatch).mockResolvedValue(makeBatch({ id: "batch-new" }));
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <CreateBatchModal
        orgSlug="o"
        concertId="concert-1"
        onCreated={onCreated}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 一般"), "一般");
    await user.type(screen.getByPlaceholderText("3000"), "2000");
    await user.type(screen.getByPlaceholderText("200"), "100");
    await user.click(screen.getByText("追加"));

    expect(ticketsApi.createBatch).toHaveBeenCalledWith("o", "concert-1", {
      name: "一般",
      price: 2000,
      priceStudent: null,
      totalCount: 100,
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "batch-new" }));
  });

  it("必須項目が空の場合は送信ボタンが無効", () => {
    render(
      <CreateBatchModal orgSlug="o" concertId="concert-1" onCreated={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText("追加")).toBeDisabled();
  });

  it("通信エラー時は代わりの文言をalertで表示する", async () => {
    vi.mocked(ticketsApi.createBatch).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(
      <CreateBatchModal orgSlug="o" concertId="concert-1" onCreated={vi.fn()} onClose={vi.fn()} />,
    );

    await user.type(screen.getByPlaceholderText("例: 一般"), "一般");
    await user.type(screen.getByPlaceholderText("3000"), "2000");
    await user.type(screen.getByPlaceholderText("200"), "100");
    await user.click(screen.getByText("追加"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "席種の保存に失敗しました。もう一度お試しください。",
    );
  });

  it("キャンセルでoncloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <CreateBatchModal orgSlug="o" concertId="concert-1" onCreated={vi.fn()} onClose={onClose} />,
    );

    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("EditBatchModal", () => {
  it("既存の値を初期値として表示する", () => {
    render(
      <EditBatchModal
        orgSlug="o"
        concertId="concert-1"
        batch={makeBatch()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("一般")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });

  it("保存するとupdateBatchが呼ばれonUpdatedが呼ばれる", async () => {
    vi.mocked(ticketsApi.updateBatch).mockResolvedValue(makeBatch({ name: "改称後" }));
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    render(
      <EditBatchModal
        orgSlug="o"
        concertId="concert-1"
        batch={makeBatch()}
        onUpdated={onUpdated}
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const nameInput = screen.getByDisplayValue("一般");
    await user.clear(nameInput);
    await user.type(nameInput, "改称後");
    await user.click(screen.getByText("保存"));

    expect(ticketsApi.updateBatch).toHaveBeenCalledWith(
      "o",
      "concert-1",
      "batch-1",
      expect.objectContaining({ name: "改称後" }),
    );
    expect(onUpdated).toHaveBeenCalled();
  });

  it("「この席種を削除」→確認画面→キャンセルで戻る", async () => {
    const user = userEvent.setup();
    render(
      <EditBatchModal
        orgSlug="o"
        concertId="concert-1"
        batch={makeBatch()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByText("この席種を削除"));
    const confirm = screen.getByRole("dialog", { name: "「一般」を削除しますか？" });
    expect(within(confirm).getByRole("button", { name: "キャンセル" })).toHaveFocus();

    await user.click(within(confirm).getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByText("「一般」を削除しますか？")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("一般")).toBeInTheDocument();
  });

  it("削除を確定するとdeleteBatchが呼ばれonDeletedが呼ばれる", async () => {
    vi.mocked(ticketsApi.deleteBatch).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(
      <EditBatchModal
        orgSlug="o"
        concertId="concert-1"
        batch={makeBatch()}
        onUpdated={vi.fn()}
        onDeleted={onDeleted}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByText("この席種を削除"));
    await user.click(screen.getByText("削除する"));

    expect(ticketsApi.deleteBatch).toHaveBeenCalledWith("o", "concert-1", "batch-1");
    expect(onDeleted).toHaveBeenCalledWith("batch-1");
  });

  it("削除の確認は編集の上に重ねて開き、Escでは確認だけが閉じる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <EditBatchModal
        orgSlug="o"
        concertId="concert-1"
        batch={makeBatch()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByText("この席種を削除"));
    expect(screen.getAllByRole("dialog", { hidden: true })).toHaveLength(2);
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "「一般」を削除しますか？" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "席種を編集" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("BatchFormModal（モーダルの操作）", () => {
  function renderCreate(onClose = vi.fn()) {
    render(
      <CreateBatchModal orgSlug="o" concertId="concert-1" onCreated={vi.fn()} onClose={onClose} />,
    );
    return { onClose };
  }

  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("席種名"), "一般");
    await user.type(screen.getByLabelText("一般価格（円）"), "2000");
    await user.type(screen.getByLabelText("総枚数"), "100");
  }

  it("「席種を追加」という名前のダイアログとして開き、席種名欄にフォーカスが当たる", () => {
    renderCreate();

    expect(screen.getByRole("dialog", { name: "席種を追加" })).toBeInTheDocument();
    expect(screen.getByLabelText("席種名")).toHaveFocus();
    expect(screen.getByLabelText("学生価格（円・任意）")).toBeInTheDocument();
  });

  it("入力欄でEnterを押すと送信する", async () => {
    vi.mocked(ticketsApi.createBatch).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderCreate();

    await fillRequired(user);
    await user.type(screen.getByLabelText("総枚数"), "{Enter}");

    await waitFor(() => expect(ticketsApi.createBatch).toHaveBeenCalledTimes(1));
  });

  it("保存中はEscで閉じず、キャンセルも押せない", async () => {
    vi.mocked(ticketsApi.createBatch).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderCreate();

    await fillRequired(user);
    await user.click(screen.getByText("追加"));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });

  it("4xxのエラーはサーバーのメッセージを表示する", async () => {
    vi.mocked(ticketsApi.createBatch).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "チケット担当者または管理者のみ操作できます", 403),
    );
    const user = userEvent.setup();
    renderCreate();

    await fillRequired(user);
    await user.click(screen.getByText("追加"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "チケット担当者または管理者のみ操作できます",
    );
  });

  it("フッターはキャンセル → 追加の順に並ぶ", () => {
    renderCreate();

    const buttons = screen.getAllByRole("button", { name: /キャンセル|追加/ });
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(["キャンセル", "追加"]);
  });
});

describe("EditBatchModal（削除の失敗）", () => {
  it("削除に失敗したら確認を開いたままエラーを表示する", async () => {
    vi.mocked(ticketsApi.deleteBatch).mockRejectedValue(new TypeError("Failed to fetch"));
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(
      <EditBatchModal
        orgSlug="o"
        concertId="concert-1"
        batch={makeBatch()}
        onUpdated={vi.fn()}
        onDeleted={onDeleted}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByText("この席種を削除"));
    await user.click(screen.getByText("削除する"));

    const confirm = screen.getByRole("dialog", { name: "「一般」を削除しますか？" });
    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      "席種の削除に失敗しました。もう一度お試しください。",
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
