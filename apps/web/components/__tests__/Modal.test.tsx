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

function ChainHarness() {
  const [step, setStep] = useState<"none" | "pick" | "manage">("none");
  return (
    <>
      <button type="button" onClick={() => setStep("pick")}>
        ファイルを追加
      </button>
      {step === "pick" && (
        <Modal title="楽譜を選択" onClose={() => setStep("none")}>
          <button type="button" onClick={() => setStep("manage")}>
            楽譜A
          </button>
        </Modal>
      )}
      {step === "manage" && (
        <Modal title="ファイル管理" onClose={() => setStep("none")}>
          <input aria-label="ファイル" />
        </Modal>
      )}
    </>
  );
}

function NestedHarness() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuter(true)}>
        作成
      </button>
      {outer && (
        <Modal title="作成" onClose={() => setOuter(false)}>
          <button type="button" onClick={() => setInner(true)}>
            保存
          </button>
        </Modal>
      )}
      {inner && (
        <Modal title="保存" onClose={() => setInner(false)}>
          <input aria-label="名前" />
        </Modal>
      )}
    </>
  );
}

describe("Modal（閉じたあとのフォーカス）", () => {
  it("続けて開いたモーダルを閉じると、最初のモーダルを開いたボタンに戻る", async () => {
    const user = userEvent.setup();
    render(<ChainHarness />);

    await user.click(screen.getByRole("button", { name: "ファイルを追加" }));
    await user.click(await screen.findByRole("button", { name: "楽譜A" }));
    await screen.findByRole("dialog", { name: "ファイル管理" });
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "ファイルを追加" })).toHaveFocus(),
    );
  });

  it("重ねて開いたモーダルを閉じると、下のモーダルの中のボタンに戻る", async () => {
    const user = userEvent.setup();
    render(<NestedHarness />);

    await user.click(screen.getByRole("button", { name: "作成" }));
    await user.click(await screen.findByRole("button", { name: "保存" }));
    await screen.findByRole("dialog", { name: "保存" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toHaveFocus());
  });
});
