import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteModal, InviteSuccessModal } from "../InviteModal";
import { membersApi } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";
import type { PartSummary } from "@/lib/api-types";

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    invite: vi.fn(),
  },
}));

const parts: PartSummary[] = [{ id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 }];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InviteModal", () => {
  it("お名前・パート未入力でも、メール・ロールがあれば送信できる", async () => {
    vi.mocked(membersApi.invite).mockResolvedValue({
      inviteToken: "token",
      expiresAt: "2026-08-01T00:00:00Z",
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("メールアドレス *"), "new@example.com");
    await user.click(screen.getByText("招待メールを送信"));

    await waitFor(() => {
      expect(membersApi.invite).toHaveBeenCalledWith("tokyo", {
        email: "new@example.com",
        nameJa: undefined,
        roles: ["member"],
        partId: undefined,
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("メールアドレスが空: バリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.click(screen.getByText("招待メールを送信"));

    expect(await screen.findByText("有効なメールアドレスを入力してください")).toBeInTheDocument();
    expect(membersApi.invite).not.toHaveBeenCalled();
  });

  it("ロールをすべて解除して送信: バリデーションエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("メールアドレス *"), "new@example.com");
    // デフォルトで選択済みの「一般」チップを解除する
    await user.click(screen.getByRole("button", { name: "一般" }));
    await user.click(screen.getByText("招待メールを送信"));

    expect(await screen.findByText("ロールを1つ以上選択してください")).toBeInTheDocument();
    expect(membersApi.invite).not.toHaveBeenCalled();
  });

  it("ロールチップをクリックすると選択状態(aria-pressed)が切り替わる", async () => {
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const memberChip = screen.getByRole("button", { name: "一般" });
    expect(memberChip).toHaveAttribute("aria-pressed", "true");

    const techChip = screen.getByRole("button", { name: "技術系" });
    expect(techChip).toHaveAttribute("aria-pressed", "false");

    await user.click(techChip);
    expect(techChip).toHaveAttribute("aria-pressed", "true");

    await user.click(memberChip);
    expect(memberChip).toHaveAttribute("aria-pressed", "false");
  });

  it("パート・複数ロールを選択して送信すると、選択内容がそのまま渡される", async () => {
    vi.mocked(membersApi.invite).mockResolvedValue({
      inviteToken: "token",
      expiresAt: "2026-08-01T00:00:00Z",
    });
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("お名前"), "山田太郎");
    await user.type(screen.getByLabelText("メールアドレス *"), "new@example.com");
    await user.selectOptions(screen.getByLabelText("パート"), "part-1");
    await user.click(screen.getByRole("button", { name: "技術系" }));
    await user.click(screen.getByText("招待メールを送信"));

    await waitFor(() => {
      expect(membersApi.invite).toHaveBeenCalledWith("tokyo", {
        email: "new@example.com",
        nameJa: "山田太郎",
        roles: ["member", "tech"],
        partId: "part-1",
      });
    });
  });

  it("送信失敗(409): 登録済みメールアドレスのエラーメッセージを表示する", async () => {
    vi.mocked(membersApi.invite).mockRejectedValue(new ApiClientError("CONFLICT", "conflict", 409));
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("メールアドレス *"), "existing@example.com");
    await user.click(screen.getByText("招待メールを送信"));

    expect(
      await screen.findByText("このメールアドレスはすでに団体に登録済みです"),
    ).toBeInTheDocument();
  });

  it("送信失敗(その他): 汎用エラーメッセージを表示する", async () => {
    vi.mocked(membersApi.invite).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("メールアドレス *"), "new@example.com");
    await user.click(screen.getByText("招待メールを送信"));

    expect(
      await screen.findByText("招待メールの送信に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
  });

  it("送信中はボタンがdisabledになる", async () => {
    let resolveInvite: (value: { inviteToken: string; expiresAt: string }) => void;
    const onSuccess = vi.fn();
    vi.mocked(membersApi.invite).mockReturnValue(
      new Promise((resolve) => {
        resolveInvite = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("メールアドレス *"), "new@example.com");
    await user.click(screen.getByText("招待メールを送信"));

    expect(screen.getByText("招待メールを送信").closest("button")).toBeDisabled();

    resolveInvite!({ inviteToken: "token", expiresAt: "2026-08-01T00:00:00Z" });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("×ボタンクリックでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={onClose} onSuccess={vi.fn()} />);

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });

  it("キャンセルボタンクリックでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={onClose} onSuccess={vi.fn()} />);

    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalled();
  });

  it("モーダル本体クリックでは閉じない", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InviteModal org="tokyo" parts={parts} onClose={onClose} onSuccess={vi.fn()} />);

    await user.click(screen.getByText("メンバーを招待"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("InviteSuccessModal", () => {
  it("「招待メールを送信しました」を表示する", () => {
    render(<InviteSuccessModal onClose={vi.fn()} />);
    expect(screen.getByText("招待メールを送信しました")).toBeInTheDocument();
  });

  it("「閉じる」クリックでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InviteSuccessModal onClose={onClose} />);

    await user.click(screen.getByText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });
});
