import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteForm } from "../InviteForm";
import { authApi, ApiClientError, type InviteInfo } from "@/lib/auth-api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      acceptInvite: vi.fn(),
    },
  };
});

const invite: InviteInfo = {
  email: "user@example.com",
  nameJa: null,
  orgName: "テスト合唱団",
  orgSlug: "test-choir",
  expiresAt: "2026-12-31T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InviteForm（表示）", () => {
  it("団体名・メールアドレス・入力欄を表示する", () => {
    render(<InviteForm token="test-token" invite={invite} />);

    expect(screen.getByText("テスト合唱団 への参加登録")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("お名前")).toBeInTheDocument();
    expect(screen.getByLabelText(/8文字以上/)).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード（確認）")).toBeInTheDocument();
  });

  it("招待情報に氏名が含まれる場合はお名前欄に初期値として表示する", () => {
    render(<InviteForm token="test-token" invite={{ ...invite, nameJa: "山田太郎" }} />);

    expect(screen.getByLabelText("お名前")).toHaveValue("山田太郎");
  });

  it("目アイコンでパスワードの表示・非表示を切り替えられる", async () => {
    const user = userEvent.setup();
    render(<InviteForm token="test-token" invite={invite} />);

    const passwordInput = screen.getByLabelText(/8文字以上/);
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByLabelText("パスワードを表示する"));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByLabelText("パスワードを隠す"));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});

describe("InviteForm（バリデーション）", () => {
  it("お名前未入力の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<InviteForm token="test-token" invite={invite} />);

    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password123");
    await user.click(screen.getByText("登録する"));

    expect(await screen.findByText("お名前を入力してください")).toBeInTheDocument();
    expect(authApi.acceptInvite).not.toHaveBeenCalled();
  });

  it("パスワードが8文字未満の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    const { container } = render(<InviteForm token="test-token" invite={invite} />);

    await user.type(screen.getByLabelText("お名前"), "山田太郎");
    await user.type(screen.getByLabelText(/8文字以上/), "short1");
    await user.type(screen.getByLabelText("パスワード（確認）"), "short1");
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("パスワードは8文字以上で入力してください")).toBeInTheDocument();
    expect(authApi.acceptInvite).not.toHaveBeenCalled();
  });

  it("パスワード（確認）が一致しない場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<InviteForm token="test-token" invite={invite} />);

    await user.type(screen.getByLabelText("お名前"), "山田太郎");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password456");
    await user.click(screen.getByText("登録する"));

    expect(await screen.findByText("パスワードが一致しません")).toBeInTheDocument();
    expect(authApi.acceptInvite).not.toHaveBeenCalled();
  });
});

describe("InviteForm（送信）", () => {
  it("登録成功時はauthApi.acceptInviteが呼ばれ完了画面へ切り替わる", async () => {
    vi.mocked(authApi.acceptInvite).mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    render(<InviteForm token="test-token" invite={invite} />);

    await user.type(screen.getByLabelText("お名前"), "山田太郎");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password123");
    await user.click(screen.getByText("登録する"));

    expect(authApi.acceptInvite).toHaveBeenCalledWith("test-token", {
      nameJa: "山田太郎",
      password: "password123",
    });
    expect(await screen.findByText("登録が完了しました")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByText("ログインページへ"));
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("409エラー時は登録済みメッセージを表示する", async () => {
    vi.mocked(authApi.acceptInvite).mockRejectedValue(
      new ApiClientError("CONFLICT", "conflict", 409),
    );
    const user = userEvent.setup();
    render(<InviteForm token="test-token" invite={invite} />);

    await user.type(screen.getByLabelText("お名前"), "山田太郎");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password123");
    await user.click(screen.getByText("登録する"));

    expect(
      await screen.findByText(
        "このメールアドレスはすでに登録済みです。ログインページからログインしてください。",
      ),
    ).toBeInTheDocument();
  });

  it("409以外のエラー時は汎用メッセージを表示する", async () => {
    vi.mocked(authApi.acceptInvite).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<InviteForm token="test-token" invite={invite} />);

    await user.type(screen.getByLabelText("お名前"), "山田太郎");
    await user.type(screen.getByLabelText(/8文字以上/), "password123");
    await user.type(screen.getByLabelText("パスワード（確認）"), "password123");
    await user.click(screen.getByText("登録する"));

    expect(
      await screen.findByText("登録に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
  });
});
