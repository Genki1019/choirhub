import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmailChangeConfirmPage from "../page";
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
      getEmailChangeToken: vi.fn(),
      confirmEmailChange: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("EmailChangeConfirmPage（読み込み）", () => {
  it("トークン検証中はローディングスピナーを表示する", () => {
    vi.mocked(authApi.getEmailChangeToken).mockReturnValue(new Promise(() => {}));
    const { container } = render(<EmailChangeConfirmPage />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("トークンが無効な場合はエラーメッセージを表示する", async () => {
    vi.mocked(authApi.getEmailChangeToken).mockRejectedValue(new Error("not found"));
    render(<EmailChangeConfirmPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "リンクが無効または期限切れです。もう一度メールアドレス変更を申請してください。",
        ),
      ).toBeInTheDocument();
    });
  });

  it("トークンが有効な場合は変更先メールアドレスと確認ボタンを表示する", async () => {
    vi.mocked(authApi.getEmailChangeToken).mockResolvedValue({ newEmail: "new@example.com" });
    render(<EmailChangeConfirmPage />);

    expect(await screen.findByText("new@example.com")).toBeInTheDocument();
    expect(screen.getByText("このメールアドレスに変更する")).toBeInTheDocument();
  });
});

describe("EmailChangeConfirmPage（確定）", () => {
  beforeEach(() => {
    vi.mocked(authApi.getEmailChangeToken).mockResolvedValue({ newEmail: "new@example.com" });
  });

  it("確定成功時はauthApi.confirmEmailChangeが呼ばれ完了画面へ切り替わる", async () => {
    vi.mocked(authApi.confirmEmailChange).mockResolvedValue({
      message: "ok",
      email: "new@example.com",
    });
    const user = userEvent.setup();
    render(<EmailChangeConfirmPage />);

    await screen.findByText("new@example.com");
    await user.click(screen.getByText("このメールアドレスに変更する"));

    expect(authApi.confirmEmailChange).toHaveBeenCalledWith("test-token");
    expect(await screen.findByText("メールアドレスを変更しました")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByText("ログインページへ"));
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("409エラー時は使用済みメッセージを表示する", async () => {
    vi.mocked(authApi.confirmEmailChange).mockRejectedValue(
      new ApiClientError("CONFLICT", "conflict", 409),
    );
    const user = userEvent.setup();
    render(<EmailChangeConfirmPage />);

    await screen.findByText("new@example.com");
    await user.click(screen.getByText("このメールアドレスに変更する"));

    expect(
      await screen.findByText("このメールアドレスは既に使用されています。"),
    ).toBeInTheDocument();
  });

  it("404エラー時はリンク無効メッセージを表示する", async () => {
    vi.mocked(authApi.confirmEmailChange).mockRejectedValue(
      new ApiClientError("NOT_FOUND", "not found", 404),
    );
    const user = userEvent.setup();
    render(<EmailChangeConfirmPage />);

    await screen.findByText("new@example.com");
    await user.click(screen.getByText("このメールアドレスに変更する"));

    expect(
      await screen.findByText("リンクが無効または期限切れです。もう一度申請してください。"),
    ).toBeInTheDocument();
  });

  it("その他のエラー時は汎用メッセージを表示する", async () => {
    vi.mocked(authApi.confirmEmailChange).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<EmailChangeConfirmPage />);

    await screen.findByText("new@example.com");
    await user.click(screen.getByText("このメールアドレスに変更する"));

    expect(
      await screen.findByText("メールアドレスの変更に失敗しました。しばらく後でお試しください。"),
    ).toBeInTheDocument();
  });
});
