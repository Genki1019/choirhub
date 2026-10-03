import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddVisitorApplicationModal } from "../AddVisitorApplicationModal";
import { visitorApplicationsApi } from "@/lib/visitor-applications-api";
import type { PartSummary } from "@/lib/api-types";

vi.mock("@/lib/visitor-applications-api", () => ({
  visitorApplicationsApi: {
    create: vi.fn(),
  },
}));

const parts: PartSummary[] = [
  { id: "part-1", name: "テノール", voiceType: "tenor", sortOrder: 1 },
  { id: "part-2", name: "バス", voiceType: "bass", sortOrder: 2 },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AddVisitorApplicationModal", () => {
  it("お名前のみ入力して送信できる", async () => {
    vi.mocked(visitorApplicationsApi.create).mockResolvedValue({
      id: "app-1",
      name: "見学 太郎",
      partHope: null,
      originGroup: null,
      contact: null,
      message: null,
      source: "manual",
      status: "pending",
      createdByName: "山田太郎",
      reviewedByName: null,
      reviewedAt: null,
      createdAt: "2026-07-20T00:00:00Z",
    });
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("お名前 *"), "見学 太郎");
    await user.click(screen.getByText("登録する"));

    await waitFor(() => {
      expect(visitorApplicationsApi.create).toHaveBeenCalledWith("tokyo", {
        name: "見学 太郎",
        partHope: undefined,
        originGroup: undefined,
        contact: undefined,
        message: undefined,
      });
    });
    expect(
      await screen.findByRole("dialog", { name: "見学申込を登録しました" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("管理者が承認すると");
  });

  it("お名前が空: バリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={vi.fn()} />);

    await user.click(screen.getByText("登録する"));

    expect(await screen.findByText("お名前を入力してください")).toBeInTheDocument();
    expect(visitorApplicationsApi.create).not.toHaveBeenCalled();
  });

  it("希望パート・出身団体・連絡先・コメントを入力して送信すると、そのまま渡される", async () => {
    vi.mocked(visitorApplicationsApi.create).mockResolvedValue({
      id: "app-1",
      name: "見学 太郎",
      partHope: "テノール",
      originGroup: "○○大学",
      contact: "090-0000-0000",
      message: "よろしくお願いします",
      source: "manual",
      status: "pending",
      createdByName: null,
      reviewedByName: null,
      reviewedAt: null,
      createdAt: "2026-07-20T00:00:00Z",
    });
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("お名前 *"), "見学 太郎");
    await user.selectOptions(screen.getByLabelText("希望パート"), "テノール");
    await user.type(screen.getByLabelText("出身団体"), "○○大学");
    await user.type(screen.getByLabelText("連絡先"), "090-0000-0000");
    await user.type(screen.getByLabelText("コメント"), "よろしくお願いします");
    await user.click(screen.getByText("登録する"));

    await waitFor(() => {
      expect(visitorApplicationsApi.create).toHaveBeenCalledWith("tokyo", {
        name: "見学 太郎",
        partHope: "テノール",
        originGroup: "○○大学",
        contact: "090-0000-0000",
        message: "よろしくお願いします",
      });
    });
  });

  it("希望パートは団体のパート一覧のみをプルダウンで選択できる", () => {
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={vi.fn()} />);

    const select = screen.getByLabelText("希望パート") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toEqual(["未定", "テノール", "バス"]);
  });

  it("送信失敗: エラーメッセージを表示する", async () => {
    vi.mocked(visitorApplicationsApi.create).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("お名前 *"), "見学 太郎");
    await user.click(screen.getByText("登録する"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "見学申込の登録に失敗しました。もう一度お試しください。",
    );
  });

  it("×ボタンクリックでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={onClose} />);

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });

  it("キャンセルボタンクリックでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={onClose} />);

    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalled();
  });

  it("「見学者を追加」という名前のモーダルダイアログとして開き、お名前欄にフォーカスが当たる", () => {
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "見学者を追加" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByLabelText("お名前 *")).toHaveFocus();
  });

  it("送信中はEscで閉じず、×・キャンセルも押せない", async () => {
    vi.mocked(visitorApplicationsApi.create).mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={onClose} />);

    await user.type(screen.getByLabelText("お名前 *"), "見学 太郎{Enter}");
    await waitFor(() => expect(visitorApplicationsApi.create).toHaveBeenCalledTimes(1));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("閉じる")).toBeDisabled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });

  it("完了表示では「閉じる」ボタンにフォーカスが当たり、押すとonCloseが呼ばれる", async () => {
    vi.mocked(visitorApplicationsApi.create).mockResolvedValue({
      id: "app-1",
      name: "見学 太郎",
      partHope: null,
      originGroup: null,
      contact: null,
      message: null,
      source: "manual",
      status: "pending",
      createdByName: "山田太郎",
      reviewedByName: null,
      reviewedAt: null,
      createdAt: "2026-07-20T00:00:00Z",
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddVisitorApplicationModal org="tokyo" parts={parts} onClose={onClose} />);

    await user.type(screen.getByLabelText("お名前 *"), "見学 太郎");
    await user.click(screen.getByText("登録する"));
    const closeButton = await screen.findByText("閉じる");

    expect(closeButton).toHaveFocus();
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
