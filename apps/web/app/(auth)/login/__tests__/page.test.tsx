import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../page";
import { authApi, ApiClientError } from "@/lib/auth-api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      login: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("LoginPage（表示）", () => {
  it("メールアドレス・パスワード入力欄とログインボタンを表示する", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
    expect(screen.getByText("ログイン")).toBeInTheDocument();
  });

  it("「パスワードをお忘れですか？」は/password-resetにリンクする", () => {
    render(<LoginPage />);

    expect(screen.getByText("パスワードをお忘れですか？").closest("a")).toHaveAttribute(
      "href",
      "/password-reset",
    );
  });
});

describe("LoginPage（バリデーション）", () => {
  it("メール形式が不正な場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    const { container } = render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "invalid-email");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("有効なメールアドレスを入力してください")).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("パスワード未入力の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.click(screen.getByText("ログイン"));

    expect(await screen.findByText("パスワードを入力してください")).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });
});

describe("LoginPage（送信）", () => {
  it("ログイン成功時はauthApi.loginが呼ばれ/select-orgへ遷移する", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      user: { id: "u1", nameJa: "山田太郎", email: "user@example.com", avatarUrl: null },
      orgs: [],
    });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByText("ログイン"));

    expect(authApi.login).toHaveBeenCalledWith("user@example.com", "password123");
    expect(push).toHaveBeenCalledWith("/select-org");
  });

  it("401エラー時は専用メッセージを表示する", async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiClientError("UNAUTHORIZED", "unauthorized", 401),
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.type(screen.getByLabelText("パスワード"), "wrongpass");
    await user.click(screen.getByText("ログイン"));

    expect(
      await screen.findByText("メールアドレスまたはパスワードが正しくありません"),
    ).toBeInTheDocument();
  });

  it("401以外のエラー時は汎用メッセージを表示する", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByText("ログイン"));

    expect(
      await screen.findByText("ログインに失敗しました。しばらく後でお試しください。"),
    ).toBeInTheDocument();
  });
});
