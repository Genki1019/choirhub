import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordResetConfirmPage from "../page";
import { authApi, ApiClientError } from "@/lib/auth-api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "test-token" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      getPasswordResetToken: vi.fn(),
      confirmPasswordReset: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PasswordResetConfirmPage（読み込み）", () => {
  it("トークン検証中はローディングスピナーを表示する", () => {
    vi.mocked(authApi.getPasswordResetToken).mockReturnValue(new Promise(() => {}));
    const { container } = render(<PasswordResetConfirmPage />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("トークンが無効な場合はエラーメッセージと再申請リンクを表示する", async () => {
    vi.mocked(authApi.getPasswordResetToken).mockRejectedValue(new Error("not found"));
    render(<PasswordResetConfirmPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "リンクが無効または期限切れです。もう一度パスワードリセットを申請してください。",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("再申請する").closest("a")).toHaveAttribute("href", "/password-reset");
  });

  it("トークンが有効な場合はメールアドレスとフォームを表示する", async () => {
    vi.mocked(authApi.getPasswordResetToken).mockResolvedValue({ email: "user@example.com" });
    render(<PasswordResetConfirmPage />);

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText(/8文字以上/)).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード（確認）")).toBeInTheDocument();
  });
});

describe("PasswordResetConfirmPage（バリデーション・送信）", () => {
  beforeEach(() => {
    vi.mocked(authApi.getPasswordResetToken).mockResolvedValue({ email: "user@example.com" });
  });

  it("パスワードが8文字未満の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordResetConfirmPage />);

    await screen.findByText("user@example.com");
    await user.type(screen.getByLabelText(/8文字以上/), "short1");
    await user.type(screen.getByLabelText("パスワード（確認）"), "short1");
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("パスワードは8文字以上で入力してください")).toBeInTheDocument();
    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("パスワード（確認）が一致しない場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<PasswordResetConfirmPage />);

    await screen.findByText("user@example.com");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password456");
    await user.click(screen.getByText("パスワードを変更する"));

    expect(await screen.findByText("パスワードが一致しません")).toBeInTheDocument();
    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("目アイコンでパスワードの表示・非表示を切り替えられる", async () => {
    const user = userEvent.setup();
    render(<PasswordResetConfirmPage />);

    await screen.findByText("user@example.com");
    const passwordInput = screen.getByLabelText(/8文字以上/);
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByLabelText("パスワードを表示する"));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByLabelText("パスワードを隠す"));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("変更成功時はauthApi.confirmPasswordResetが呼ばれ完了画面へ切り替わる", async () => {
    vi.mocked(authApi.confirmPasswordReset).mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    render(<PasswordResetConfirmPage />);

    await screen.findByText("user@example.com");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password123");
    await user.click(screen.getByText("パスワードを変更する"));

    expect(authApi.confirmPasswordReset).toHaveBeenCalledWith("test-token", "password123");
    expect(await screen.findByText("パスワードを変更しました")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByText("ログインページへ"));
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("404エラー時はリンク無効メッセージを表示する", async () => {
    vi.mocked(authApi.confirmPasswordReset).mockRejectedValue(
      new ApiClientError("NOT_FOUND", "not found", 404),
    );
    const user = userEvent.setup();
    render(<PasswordResetConfirmPage />);

    await screen.findByText("user@example.com");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password123");
    await user.click(screen.getByText("パスワードを変更する"));

    expect(
      await screen.findByText("リンクが無効または期限切れです。もう一度申請してください。"),
    ).toBeInTheDocument();
  });

  it("404以外のエラー時は汎用メッセージを表示する", async () => {
    vi.mocked(authApi.confirmPasswordReset).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<PasswordResetConfirmPage />);

    await screen.findByText("user@example.com");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password123");
    await user.click(screen.getByText("パスワードを変更する"));

    expect(
      await screen.findByText("パスワードの変更に失敗しました。しばらく後でお試しください。"),
    ).toBeInTheDocument();
  });
});
