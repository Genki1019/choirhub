import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../Modal";

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn();
  render(
    <Modal title="支出を追加" onClose={onClose} {...props}>
      <label htmlFor="title">件名</label>
      <input id="title" />
    </Modal>,
  );
  return { onClose };
}

function Harness({ onSubmit }: { onSubmit?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        開く
      </button>
      <button type="button">外のボタン</button>
      {open && (
        <Modal
          title="支出を追加"
          onClose={() => setOpen(false)}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
          footer={<button type="submit">追加する</button>}
        >
          <label htmlFor="title">件名</label>
          <input id="title" />
        </Modal>
      )}
    </>
  );
}

describe("Modal", () => {
  it("タイトルをアクセシブルネームに持つモーダルダイアログとして表示する", () => {
    renderModal({ description: "カテゴリと金額を入力します" });

    const dialog = screen.getByRole("dialog", { name: "支出を追加" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("カテゴリと金額を入力します");
  });

  it("Escape・×ボタン・オーバーレイのクリックでonCloseを呼ぶ", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    await user.click(document.querySelector('[data-slot="dialog-overlay"]')!);

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("busyのときはEscape・オーバーレイで閉じず、×ボタンは押せない", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ busy: true });

    await user.keyboard("{Escape}");
    await user.click(document.querySelector('[data-slot="dialog-overlay"]')!);

    expect(screen.getByRole("button", { name: "閉じる" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("onSubmitを渡すと本文とフッターをformで囲み、入力欄のEnterで送信する", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "開く" }));
    await user.type(screen.getByLabelText("件名"), "練習室代{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("onSubmitがなければformを描画しない", () => {
    renderModal();
    expect(screen.getByRole("dialog").querySelector("form")).not.toBeInTheDocument();
  });

  it("開くと本文の最初の入力欄にフォーカスが当たる", () => {
    renderModal();
    expect(screen.getByLabelText("件名")).toHaveFocus();
  });

  it("開くとフォーカスがモーダル内に移り、Tabで外に出ず、閉じると元のボタンに戻る", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "開く" });

    await user.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
