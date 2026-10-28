import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("「団体作成を申請」は/applyにリンクする", () => {
    render(<LoginPage />);

    expect(screen.getByRole("link", { name: "団体作成を申請" })).toHaveAttribute("href", "/apply");
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
      user: {
        id: "u1",
        nameJa: "山田太郎",
        email: "user@example.com",
        avatarUrl: null,
        isSystemAdmin: false,
      },
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません",
    );
  });

  it("401以外のエラー時は汎用メッセージを表示する", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "user@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByText("ログイン"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログインに失敗しました。しばらく後でお試しください。",
    );
  });
});

describe("LoginPage（項目ごとのエラーと入力欄の関連付け）", () => {
  it("空のまま送信すると、各欄にエラーを関連付け、最初の欄にフォーカスを移す", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "ログイン" }));

    const email = screen.getByLabelText("メールアドレス");
    const password = screen.getByLabelText("パスワード");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("有効なメールアドレスを入力してください");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("パスワードを入力してください");
    await waitFor(() => expect(email).toHaveFocus());
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("メールの形式が誤っていても、ブラウザの検証ではなく日本語のエラーを出す", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "abc");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(screen.getByLabelText("メールアドレス")).toHaveAccessibleDescription(
      "有効なメールアドレスを入力してください",
    );
    expect(screen.getByLabelText("パスワード")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("パスワード")).not.toHaveAttribute("aria-describedby");
  });

  it("直すと、aria-invalid と説明が消える", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "ログイン" }));
    await user.type(screen.getByLabelText("パスワード"), "password123");

    expect(screen.getByLabelText("パスワード")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("パスワード")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("パスワードを入力してください")).not.toBeInTheDocument();
  });

  it("ログインの失敗（サーバーのエラー）では、フォーカスを動かさない", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiClientError("UNAUTHORIZED", "x", 401));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("メールアドレス"), "a@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません",
    );
    expect(screen.getByRole("button", { name: "ログイン" })).toHaveFocus();
  });
});
