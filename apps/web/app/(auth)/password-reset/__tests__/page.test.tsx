import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordResetRequestPage from "../page";
import { authApi } from "@/lib/auth-api";

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      requestPasswordReset: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PasswordResetRequestPage（表示）", () => {
  it("メールアドレス入力欄と送信ボタン、ログインページへのリンクを表示する", () => {
    render(<PasswordResetRequestPage />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByText("リセットメールを送信")).toBeInTheDocument();
    expect(screen.getByText("ログインページへ戻る").closest("a")).toHaveAttribute("href", "/login");
  });
});

describe("PasswordResetRequestPage（バリデーション）", () => {
  it("メール形式が不正な場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordResetRequestPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "invalid-email");
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("有効なメールアドレスを入力してください")).toBeInTheDocument();
    expect(authApi.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("PasswordResetRequestPage（送信）", () => {
  it("送信成功時は完了画面に切り替わる", async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    render(<PasswordResetRequestPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.click(screen.getByText("リセットメールを送信"));

    expect(authApi.requestPasswordReset).toHaveBeenCalledWith("user@example.com");
    expect(await screen.findByText("メールを送信しました")).toBeInTheDocument();
    expect(screen.getByText("ログインページへ").closest("a")).toHaveAttribute("href", "/login");
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<PasswordResetRequestPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.click(screen.getByText("リセットメールを送信"));

    expect(
      await screen.findByText("送信に失敗しました。しばらく後でお試しください。"),
    ).toBeInTheDocument();
  });
});
