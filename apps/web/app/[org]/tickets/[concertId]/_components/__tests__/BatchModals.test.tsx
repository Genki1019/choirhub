import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateBatchModal } from "../CreateBatchModal";
import { EditBatchModal } from "../EditBatchModal";
import { ticketsApi, type BatchDetail } from "@/lib/tickets-api";

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

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.createBatch).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(
      <CreateBatchModal orgSlug="o" concertId="concert-1" onCreated={vi.fn()} onClose={vi.fn()} />,
    );

    await user.type(screen.getByPlaceholderText("例: 一般"), "一般");
    await user.type(screen.getByPlaceholderText("3000"), "2000");
    await user.type(screen.getByPlaceholderText("200"), "100");
    await user.click(screen.getByText("追加"));

    expect(await screen.findByText("操作に失敗しました")).toBeInTheDocument();
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
    expect(screen.getByText("「一般」を削除しますか？")).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));
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
});
