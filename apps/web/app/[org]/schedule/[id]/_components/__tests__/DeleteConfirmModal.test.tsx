import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteConfirmModal } from "../DeleteConfirmModal";

describe("DeleteConfirmModal", () => {
  it("titleを含む確認メッセージを表示する", () => {
    render(
      <DeleteConfirmModal
        title="第12回定期練習"
        deleting={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "「第12回定期練習」と出欠情報がすべて削除されます。この操作は取り消せません。",
      ),
    ).toBeInTheDocument();
  });

  it("errorが無い場合はエラーメッセージを表示しない", () => {
    render(
      <DeleteConfirmModal
        title="第12回定期練習"
        deleting={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByText(/失敗/)).not.toBeInTheDocument();
  });

  it("errorがある場合はエラーメッセージを表示する", () => {
    render(
      <DeleteConfirmModal
        title="第12回定期練習"
        deleting={false}
        error="削除に失敗しました"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("削除に失敗しました")).toBeInTheDocument();
  });

  it("deleting=trueの場合: キャンセル・削除するボタンが両方disabledになる", () => {
    render(
      <DeleteConfirmModal
        title="第12回定期練習"
        deleting={true}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("キャンセル")).toBeDisabled();
    expect(screen.getByText("削除する").closest("button")).toBeDisabled();
  });

  it("「キャンセル」クリックでonCancelが呼ばれる", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteConfirmModal
        title="第12回定期練習"
        deleting={false}
        error={null}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    await user.click(screen.getByText("キャンセル"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("「削除する」クリックでonConfirmが呼ばれる", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteConfirmModal
        title="第12回定期練習"
        deleting={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByText("削除する"));
    expect(onConfirm).toHaveBeenCalled();
  });
});
