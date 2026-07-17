import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserMenu from "../UserMenu";
import { authApi } from "@/lib/auth-api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      logout: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("UserMenu（表示）", () => {
  it("avatarUrlが無い場合は氏名の頭文字を表示する", () => {
    render(<UserMenu nameJa="山田太郎" avatarUrl={null} org="o" memberId="member-1" />);
    expect(screen.getByText("山")).toBeInTheDocument();
  });

  it("avatarUrlがある場合は画像を表示する", () => {
    render(
      <UserMenu
        nameJa="山田太郎"
        avatarUrl="https://example.com/a.png"
        org="o"
        memberId="member-1"
      />,
    );
    expect(screen.getByAltText("山田太郎")).toBeInTheDocument();
  });

  it("初期状態ではドロップダウンを表示しない", () => {
    render(<UserMenu nameJa="山田太郎" avatarUrl={null} org="o" memberId="member-1" />);
    expect(screen.queryByText("プロフィール")).not.toBeInTheDocument();
  });
});

describe("UserMenu（開閉）", () => {
  it("アバターボタンクリックでドロップダウンが開閉する", async () => {
    const user = userEvent.setup();
    render(<UserMenu nameJa="山田太郎" avatarUrl={null} org="o" memberId="member-1" />);

    await user.click(screen.getByTitle("山田太郎"));
    expect(screen.getByText("プロフィール")).toBeInTheDocument();
    expect(screen.getByText("ログアウト")).toBeInTheDocument();

    await user.click(screen.getByTitle("山田太郎"));
    expect(screen.queryByText("プロフィール")).not.toBeInTheDocument();
  });

  it("メニュー外クリックで閉じる", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <UserMenu nameJa="山田太郎" avatarUrl={null} org="o" memberId="member-1" />
        <button>外側</button>
      </div>,
    );

    await user.click(screen.getByTitle("山田太郎"));
    expect(screen.getByText("プロフィール")).toBeInTheDocument();

    await user.click(screen.getByText("外側"));
    expect(screen.queryByText("プロフィール")).not.toBeInTheDocument();
  });

  it("「プロフィール」のリンク先が正しくクリックでメニューが閉じる", async () => {
    const user = userEvent.setup();
    render(
      <UserMenu nameJa="山田太郎" avatarUrl={null} org="tokyo-men-choir" memberId="member-1" />,
    );

    await user.click(screen.getByTitle("山田太郎"));
    const link = screen.getByText("プロフィール");
    expect(link.closest("a")).toHaveAttribute("href", "/tokyo-men-choir/members/member-1");

    await user.click(link);
    expect(screen.queryByText("プロフィール")).not.toBeInTheDocument();
  });
});

describe("UserMenu（ログアウト）", () => {
  it("「ログアウト」クリックでauthApi.logoutが呼ばれ/loginへ遷移する", async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<UserMenu nameJa="山田太郎" avatarUrl={null} org="o" memberId="member-1" />);

    await user.click(screen.getByTitle("山田太郎"));
    await user.click(screen.getByText("ログアウト"));

    expect(authApi.logout).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("ログアウトに失敗しても/loginへ遷移する", async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(<UserMenu nameJa="山田太郎" avatarUrl={null} org="o" memberId="member-1" />);

    await user.click(screen.getByTitle("山田太郎"));
    await user.click(screen.getByText("ログアウト"));

    expect(push).toHaveBeenCalledWith("/login");
  });
});
