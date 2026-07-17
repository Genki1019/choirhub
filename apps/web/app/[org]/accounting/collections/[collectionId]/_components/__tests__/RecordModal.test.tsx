import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordModal } from "../RecordModal";
import { accountingApi, type CollectionPaymentItem } from "@/lib/accounting-api";

vi.mock("@/lib/accounting-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/accounting-api")>("@/lib/accounting-api");
  return {
    ...actual,
    accountingApi: {
      recordPayment: vi.fn(),
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RecordModal（表示）", () => {
  it("団員名を表示する", () => {
    render(
      <RecordModal
        payment={makePayment()}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
  });

  it("status: pendingの場合は金額・支払日・方法欄を表示しない", () => {
    render(
      <RecordModal
        payment={makePayment({ status: "pending" })}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("金額（円）")).not.toBeInTheDocument();
  });

  it("状態を「支払済」に切り替えると金額・支払日・方法欄が表示される", async () => {
    const user = userEvent.setup();
    render(
      <RecordModal
        payment={makePayment({ status: "pending" })}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByText("支払済"));
    expect(screen.getByLabelText("金額（円）")).toBeInTheDocument();
  });

  it("金額の初期値はmemberTypeFeeがdefaultAmountより優先される", () => {
    render(
      <RecordModal
        payment={makePayment({
          status: "paid",
          amount: null,
          member: { ...makePayment().member, memberTypeFee: 1500 },
        })}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("金額（円）")).toHaveValue(1500);
  });
});

describe("RecordModal（保存）", () => {
  it("支払済で保存するとrecordPaymentが呼ばれる", async () => {
    const updated = makePayment({ status: "paid", amount: 300, method: "cash" });
    vi.mocked(accountingApi.recordPayment).mockResolvedValue(updated);
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordModal
        payment={makePayment({ status: "paid", amount: 300 })}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByText("保存する"));

    expect(accountingApi.recordPayment).toHaveBeenCalledWith(
      "o",
      "col-1",
      "member-1",
      expect.objectContaining({ status: "paid", amount: 300 }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it("未払いに変更して保存すると金額・支払日・方法はnullで送信される", async () => {
    vi.mocked(accountingApi.recordPayment).mockResolvedValue(makePayment({ status: "pending" }));
    const user = userEvent.setup();
    render(
      <RecordModal
        payment={makePayment({ status: "paid", amount: 300 })}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByText("未払い"));
    await user.click(screen.getByText("保存する"));

    expect(accountingApi.recordPayment).toHaveBeenCalledWith(
      "o",
      "col-1",
      "member-1",
      expect.objectContaining({ status: "pending", amount: null, paidAt: null, method: null }),
    );
  });

  it("保存に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(accountingApi.recordPayment).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(
      <RecordModal
        payment={makePayment({ status: "paid", amount: 300 })}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByText("保存する"));
    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
  });

  it("キャンセル・×ボタンでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordModal
        payment={makePayment()}
        defaultAmount={300}
        org="o"
        collectionId="col-1"
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
