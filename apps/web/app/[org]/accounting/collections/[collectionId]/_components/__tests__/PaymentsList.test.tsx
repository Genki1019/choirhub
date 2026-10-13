import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentsList } from "../PaymentsList";
import type { CollectionPaymentItem } from "@/lib/accounting-api";

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

function renderList(
  payments: CollectionPaymentItem[],
  overrides: Partial<Record<string, unknown>> = {},
) {
  return render(
    <PaymentsList
      payments={payments}
      amount={300}
      checkedIds={new Set()}
      onToggleCheck={vi.fn()}
      onSelectAllPending={vi.fn()}
      onQuickPaid={vi.fn().mockResolvedValue(true)}
      onEdit={vi.fn()}
      {...overrides}
    />,
  );
}

describe("PaymentsList（表示）", () => {
  it("支払済・未払い・免除の件数を表示する", () => {
    renderList([
      makePayment({ id: "p1", status: "paid" }),
      makePayment({ id: "p2", status: "pending", member: { ...makePayment().member, id: "m2" } }),
      makePayment({ id: "p3", status: "waived", member: { ...makePayment().member, id: "m3" } }),
    ]);

    expect(screen.getByText(/1名支払済 \/ 1名未払い \/ 1名免除/)).toBeInTheDocument();
  });

  it("未払いが0名の場合は「未払いを全選択」ボタンを表示しない", () => {
    renderList([makePayment({ status: "paid" })]);
    expect(screen.queryByText("未払いを全選択")).not.toBeInTheDocument();
  });

  it("支払済みの場合は支払日・支払方法を表示する", () => {
    renderList([
      makePayment({ status: "paid", paidAt: "2026-06-14T00:00:00+09:00", method: "paypay" }),
    ]);

    expect(screen.getByText("PayPay")).toBeInTheDocument();
  });

  it("金額がデフォルトと異なる場合は強調表示する", () => {
    renderList([makePayment({ status: "paid", amount: 500 })]);
    expect(screen.getByText("¥500")).toHaveClass("text-teal-600");
  });
});

describe("PaymentsList（操作）", () => {
  it("チェックボックスでonToggleCheckが呼ばれる", async () => {
    const onToggleCheck = vi.fn();
    const user = userEvent.setup();
    renderList([makePayment()], { onToggleCheck });

    await user.click(screen.getByLabelText("山田太郎を選択"));
    expect(onToggleCheck).toHaveBeenCalledWith("member-1");
  });

  it("「未払いを全選択」クリックでonSelectAllPendingが呼ばれる", async () => {
    const onSelectAllPending = vi.fn();
    const user = userEvent.setup();
    renderList([makePayment({ status: "pending" })], { onSelectAllPending });

    await user.click(screen.getByText("未払いを全選択"));
    expect(onSelectAllPending).toHaveBeenCalled();
  });

  it("「支払済」クリックでonQuickPaidが呼ばれる", async () => {
    const onQuickPaid = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    const payment = makePayment({ status: "pending" });
    renderList([payment], { onQuickPaid });

    await user.click(screen.getByLabelText("山田太郎を支払済みにする"));
    expect(onQuickPaid).toHaveBeenCalledWith(payment);
  });

  it("支払済の場合は「支払済」ボタンを表示しない", () => {
    renderList([makePayment({ status: "paid" })]);
    expect(screen.queryByLabelText("山田太郎を支払済みにする")).not.toBeInTheDocument();
  });

  it("「編集」クリックでonEditが呼ばれる", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    const payment = makePayment();
    renderList([payment], { onEdit });

    await user.click(screen.getByLabelText("山田太郎を編集"));
    expect(onEdit).toHaveBeenCalledWith(payment);
  });
});

describe("PaymentsList（「支払済」の記録中と記録後）", () => {
  it("記録中は二度押ししても1回しか記録せず、押せないことが読み上げられる", async () => {
    let finish: (ok: boolean) => void = () => {};
    const onQuickPaid = vi.fn(() => new Promise<boolean>((r) => (finish = r)));
    const user = userEvent.setup();
    renderList([makePayment()], { onQuickPaid });

    const button = screen.getByRole("button", { name: "山田太郎を支払済みにする" });
    await user.click(button);
    await user.click(button);

    expect(onQuickPaid).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    finish(false);
    await vi.waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
  });

  it("記録に成功したら、その行の「編集」ボタンにフォーカスを移す", async () => {
    const user = userEvent.setup();
    renderList([makePayment()], { onQuickPaid: vi.fn().mockResolvedValue(true) });

    await user.click(screen.getByRole("button", { name: "山田太郎を支払済みにする" }));

    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "山田太郎を編集" })).toHaveFocus(),
    );
  });

  it("記録に失敗したら、フォーカスは「支払済」ボタンに残る", async () => {
    const user = userEvent.setup();
    renderList([makePayment()], { onQuickPaid: vi.fn().mockResolvedValue(false) });

    await user.click(screen.getByRole("button", { name: "山田太郎を支払済みにする" }));

    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "山田太郎を支払済みにする" })).toHaveFocus(),
    );
  });
});
