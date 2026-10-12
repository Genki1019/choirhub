import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useInlineEdit } from "../useInlineEdit";
import { InlineEditActions, InlineEditButton } from "@/components/InlineEdit";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ApiClientError } from "@/lib/api-client";

function Harness({
  current = "テノール1",
  onSave = vi.fn(),
  validate = (v: string) => (v.trim() ? null : "パート名を入力してください"),
  disabled,
}: {
  current?: string;
  onSave?: (v: string) => void | Promise<void>;
  validate?: (v: string) => string | null;
  disabled?: boolean;
}) {
  const { registerTrigger, ...edit } = useInlineEdit({
    initial: () => current,
    onSave,
    validate,
    disabled,
    errorFallback: "更新に失敗しました。もう一度お試しください。",
  });
  return (
    <div>
      {edit.editing ? (
        <>
          <input
            aria-label="パート名"
            value={edit.value}
            onChange={(e) => edit.setValue(e.target.value)}
            onKeyDown={edit.handleKeyDown}
            autoFocus
          />
          <InlineEditActions
            label="パート名"
            saving={edit.saving}
            onSave={edit.save}
            onCancel={edit.cancel}
          />
          <ErrorMessage>{edit.error}</ErrorMessage>
        </>
      ) : (
        <>
          <span>{current}</span>
          <InlineEditButton label={current} ref={registerTrigger} onClick={edit.start} />
        </>
      )}
    </div>
  );
}

describe("useInlineEdit", () => {
  it("鉛筆で入力欄に切り替わり、今の値が入って入力欄にフォーカスが入る", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));

    const input = screen.getByRole("textbox", { name: "パート名" });
    expect(input).toHaveValue("テノール1");
    expect(input).toHaveFocus();
  });

  it("Enter で保存し、閉じたら鉛筆にフォーカスが戻る", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "テノールI{Enter}");

    expect(onSave).toHaveBeenCalledWith("テノールI");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "テノール1を編集" })).toHaveFocus(),
    );
  });

  it("✓ で保存する", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A");
    await userEvent.click(screen.getByRole("button", { name: "パート名を保存" }));

    expect(onSave).toHaveBeenCalledWith("テノール1A");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("Esc と × でキャンセルし、保存せずに鉛筆へフォーカスを戻す", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "テノール1を編集" })).toHaveFocus(),
    );

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.click(screen.getByRole("button", { name: "パート名の編集をキャンセル" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("開き直すと、前回の入力ではなく今の値から始まる", async () => {
    const { rerender } = render(<Harness current="テノール1" />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "途中{Escape}");
    rerender(<Harness current="テノールI" />);
    await userEvent.click(screen.getByRole("button", { name: "テノールIを編集" }));

    expect(screen.getByRole("textbox")).toHaveValue("テノールI");
  });

  it("値を変えずに保存すると、保存処理を呼ばずに閉じる", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("前後の空白だけを変えて保存すると、保存処理を呼ばずに閉じる", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "  {Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("入力チェックに通らなければ、理由を出して編集を続ける", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.keyboard("{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("パート名を入力してください");
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("保存中は ✓・× を押せず、Esc でも閉じない", async () => {
    const onSave = vi.fn(() => new Promise<void>(() => {}));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A{Enter}");
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "パート名を保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "パート名の編集をキャンセル" })).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("失敗したら理由を出し、入力を残して編集を続ける（4xx は API の理由）", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new ApiClientError("CONFLICT", "同じ名前のパートがあります", 409));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("同じ名前のパートがあります");
    expect(screen.getByRole("textbox")).toHaveValue("テノール1A");
    expect(screen.getByRole("button", { name: "パート名を保存" })).toBeEnabled();
  });

  it("通信エラーなど 5xx 相当は代わりの文言を出す", async () => {
    const onSave = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "更新に失敗しました。もう一度お試しください。",
    );
  });

  it("日本語の変換中の Enter では保存しない", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", isComposing: true });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("disabled の間は ✓・Enter で保存しない", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} disabled />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "パート名を保存" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("テノール1A");
  });

  it("保存処理は同期関数でもよい", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "テノール1を編集" }));
    await userEvent.type(screen.getByRole("textbox"), "A{Enter}");

    expect(onSave).toHaveBeenCalledWith("テノール1A");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
