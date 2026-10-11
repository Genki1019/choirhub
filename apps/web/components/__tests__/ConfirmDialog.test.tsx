import { useEffect, useRef, useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../ConfirmDialog";
import { Modal } from "../Modal";

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="支出を削除しますか？"
      description="この操作は取り消せません。"
      confirmLabel="削除する"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        削除
      </button>
      {open && (
        <ConfirmDialog
          title="支出を削除しますか？"
          confirmLabel="削除する"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe("ConfirmDialog", () => {
  it("alertdialog としてタイトルと説明を読み上げられる", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog", { name: "支出を削除しますか？" });
    expect(dialog).toHaveAccessibleDescription("この操作は取り消せません。");
  });

  it("開いた直後はキャンセルにフォーカスがある", async () => {
    renderDialog();

    await waitFor(() => expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus());
  });

  it("確定ボタンで onConfirm を呼ぶ", async () => {
    const { onConfirm, onCancel } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "削除する" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("キャンセルと Esc で onCancel を呼ぶ", async () => {
    const { onCancel } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("Esc は確認だけを閉じ、document で Esc を拾う手書きのモーダルには届かない", async () => {
    const onDocumentEscape = vi.fn();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDocumentEscape();
    };
    document.addEventListener("keydown", handler);
    const { onCancel } = renderDialog();

    await userEvent.keyboard("{Escape}");
    document.removeEventListener("keydown", handler);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDocumentEscape).not.toHaveBeenCalled();
  });

  it("外側のクリックでは閉じない", async () => {
    const { onCancel } = renderDialog();

    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("実行中は両方のボタンを押せず、Esc でも閉じない", async () => {
    const { onCancel } = renderDialog({ busy: true });

    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "削除する" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("エラーをダイアログの中に表示する", () => {
    renderDialog({ error: "削除に失敗しました" });

    const alert = screen.getByRole("alert");
    expect(screen.getByRole("alertdialog")).toContainElement(alert);
    expect(alert).toHaveTextContent("削除に失敗しました");
  });

  it("tone=primary は確定ボタンをブランド色にする", () => {
    renderDialog({ tone: "primary", confirmLabel: "公開する" });

    expect(screen.getByRole("button", { name: "公開する" })).toHaveClass("bg-brand-600");
  });

  it("閉じたら開いたボタンにフォーカスを戻す", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "削除" });

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("開いたボタンが削除で消えたら、同じ一覧に残っている最初の操作できる要素にフォーカスを移す", async () => {
    function List() {
      const [items, setItems] = useState(["練習", "合宿"]);
      const [target, setTarget] = useState<string | null>(null);
      return (
        <>
          <ul>
            {items.map((item) => (
              <li key={item}>
                <button type="button" onClick={() => setTarget(item)}>
                  {item}を削除
                </button>
              </li>
            ))}
          </ul>
          {target && (
            <ConfirmDialog
              title="区分を削除しますか？"
              confirmLabel="削除する"
              onConfirm={() => {
                setItems((prev) => prev.filter((i) => i !== target));
                setTarget(null);
              }}
              onCancel={() => setTarget(null)}
            />
          )}
        </>
      );
    }
    render(<List />);

    await userEvent.click(screen.getByRole("button", { name: "練習を削除" }));
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "合宿を削除" })).toHaveFocus());
  });

  it("一覧の最後の1件を消したら、さらに外側の操作できる要素にフォーカスを移す", async () => {
    function Card() {
      const [items, setItems] = useState(["練習"]);
      const [target, setTarget] = useState<string | null>(null);
      return (
        <section>
          <button type="button">追加</button>
          <ul>
            {items.length === 0 && <li>区分がありません</li>}
            {items.map((item) => (
              <li key={item}>
                <button type="button" onClick={() => setTarget(item)}>
                  {item}を削除
                </button>
              </li>
            ))}
          </ul>
          {target && (
            <ConfirmDialog
              title="区分を削除しますか？"
              confirmLabel="削除する"
              onConfirm={() => {
                setItems([]);
                setTarget(null);
              }}
              onCancel={() => setTarget(null)}
            />
          )}
        </section>
      );
    }
    render(<Card />);

    await userEvent.click(screen.getByRole("button", { name: "練習を削除" }));
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "追加" })).toHaveFocus());
  });

  it("閉じる時点で画面側が別の要素にフォーカスを移していれば、それを上書きしない", async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      const [deleted, setDeleted] = useState(false);
      const addRef = useRef<HTMLButtonElement>(null);
      useEffect(() => {
        if (deleted) addRef.current?.focus();
      }, [deleted]);
      return (
        <main>
          <button type="button">戻る</button>
          <button type="button" ref={addRef}>
            席種を追加
          </button>
          {!open ? (
            <div>
              <button type="button" onClick={() => setOpen(true)}>
                この席種を削除
              </button>
            </div>
          ) : (
            <ConfirmDialog
              title="席種を削除しますか？"
              confirmLabel="削除する"
              onConfirm={() => {
                setOpen(false);
                setDeleted(true);
              }}
              onCancel={() => setOpen(false)}
            />
          )}
        </main>
      );
    }
    render(<Page />);

    await userEvent.click(screen.getByRole("button", { name: "この席種を削除" }));
    const trigger = screen.queryByRole("button", { name: "この席種を削除" });
    expect(trigger).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "席種を追加" })).toHaveFocus());
  });

  it("モーダルの上に重ねて開いたとき、Esc では確認だけが閉じる", async () => {
    const onModalClose = vi.fn();
    function Nested() {
      const [confirming, setConfirming] = useState(true);
      return (
        <Modal title="ファイル管理" onClose={onModalClose}>
          <p>ファイル一覧</p>
          {confirming && (
            <ConfirmDialog
              title="ファイルを削除しますか？"
              confirmLabel="削除する"
              onConfirm={() => setConfirming(false)}
              onCancel={() => setConfirming(false)}
            />
          )}
        </Modal>
      );
    }
    render(<Nested />);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "ファイル管理" })).toBeInTheDocument();
    expect(onModalClose).not.toHaveBeenCalled();
  });
});
